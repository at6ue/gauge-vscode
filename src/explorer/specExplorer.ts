'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {
    commands, Disposable, Position, Range, TextDocument, TextDocumentShowOptions,
    TextEditor, Uri, window, workspace
} from 'vscode';
import { LanguageClient, TextDocumentIdentifier } from 'vscode-languageclient/node';
import { GaugeCommandContext, GaugeRequests, GaugeVSCodeCommands, setCommandContext } from '../constants';
import { ExecutionConfig } from '../execution/executionConfig';
import { GaugeWorkspace } from '../gaugeWorkspace';

const extensions = [".spec", ".md"];

export class SpecNodeProvider extends Disposable implements vscode.TreeDataProvider<GaugeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<GaugeNode | undefined> =
        new vscode.EventEmitter<GaugeNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<GaugeNode | undefined> = this._onDidChangeTreeData.event;
    private activeFolder: string;
    private _disposable: Disposable;
    private _languageClient?: LanguageClient;

    constructor(private gaugeWorkspace: GaugeWorkspace) {
        super(() => this.dispose());
        setCommandContext(GaugeCommandContext.Activated, false);
        if (isSpecExplorerEnabled()) {
            const disposable = window.registerTreeDataProvider(GaugeCommandContext.GaugeSpecExplorer, this);
            this.activeFolder = gaugeWorkspace.getDefaultFolder();
            this.activateTreeDataProvider(this.activeFolder);
            const refreshMethod = (fileUri: vscode.Uri) => {
                if (this.shouldRefresh(fileUri)) {
                    this.refresh();
                }
            };
            vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
                refreshMethod(doc.uri);
            });
            workspace.onDidCloseTextDocument((doc: TextDocument) => {
                refreshMethod(doc.uri);
            });

            const watcher = workspace.createFileSystemWatcher("**/*.{spec,md}", true, false, true);
            watcher.onDidCreate(refreshMethod);
            watcher.onDidDelete(refreshMethod);

            this._disposable = Disposable.from(disposable, watcher,
                commands.registerCommand(GaugeVSCodeCommands.SwitchProject,
                    () => gaugeWorkspace.showProjectOptions((path: string) => {
                        this.changeClient(path);
                    })
                ),
                commands.registerCommand(GaugeVSCodeCommands.ExecuteAllSpecExplorer, () => {
                    return this.gaugeWorkspace.getGaugeExecutor().runSpecification(this.activeFolder);
                }),
                commands.registerCommand(GaugeVSCodeCommands.ExecuteScenario, (scn: Scenario) => {
                    if (scn) return this.gaugeWorkspace.getGaugeExecutor().execute(scn.executionIdentifier,
                        new ExecutionConfig().setStatus(scn.executionIdentifier)
                            .setProject(this.gaugeWorkspace.getClientsMap().get(scn.file).project));
                    return this.gaugeWorkspace.getGaugeExecutor().runScenario(true);
                }),
                commands.registerCommand(GaugeVSCodeCommands.ExecuteSpec, (spec: Spec) => {
                    if (spec) {
                        return this.gaugeWorkspace.getGaugeExecutor().execute(spec.file,
                            new ExecutionConfig().setStatus(spec.file)
                                .setProject(this.gaugeWorkspace.getClientsMap().get(spec.file).project));
                    }
                    return this.gaugeWorkspace.getGaugeExecutor().runSpecification();
                }),
                commands.registerCommand(GaugeVSCodeCommands.Open,
                    (node: GaugeNode) => workspace.openTextDocument(node.file)
                        .then(this.showDocumentWithSelection(node))),

                commands.registerCommand(GaugeVSCodeCommands.ExecuteNode, (node: GaugeNode) =>
                    this.gaugeWorkspace.getGaugeExecutor().execute(
                        node instanceof Scenario ? node.executionIdentifier : node.file,
                        new ExecutionConfig().setStatus(node.file)
                            .setProject(this.gaugeWorkspace.getClientsMap().get(node.file).project))
                ),

                commands.registerCommand(GaugeVSCodeCommands.DebugNode, (node: GaugeNode) =>
                    this.gaugeWorkspace.getGaugeExecutor().execute(
                        node instanceof Scenario ? node.executionIdentifier : node.file,
                        new ExecutionConfig().setStatus(node.file).setDebug()
                            .setProject(this.gaugeWorkspace.getClientsMap().get(node.file).project))
                )
            );
        }
    }

    refresh(element?: GaugeNode): void {
        this._onDidChangeTreeData.fire(element);
    }

    getTreeItem(element: GaugeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GaugeNode): Thenable<GaugeNode[]> {
        if (!this.activeFolder) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }
        if (!this._languageClient) return Promise.resolve([]);

        return new Promise((resolve, reject) => {
            if (element && element.contextValue === "specification") {
                let uri = TextDocumentIdentifier.create(element.file);
                return this._languageClient.sendRequest(GaugeRequests.Scenarios, {
                    textDocument: uri,
                    position: new vscode.Position(1, 1)
                }, new vscode.CancellationTokenSource().token).then(
                    (val: any[]) => {
                        resolve(val.map((x) => {
                            const specFile = x.executionIdentifier.split(":" + x.lineNo)[0];
                            return new Scenario(x.heading, specFile, x.lineNo);
                        }));
                    },
                    (reason) => { console.log(reason); reject(reason); }
                );
            } else {
                let token = new vscode.CancellationTokenSource().token;
                return this._languageClient.sendRequest(GaugeRequests.Specs, {}, token)
                    .then(
                        (val: any[]) => {
                            resolve(val.map((x) => {
                                if (x.heading) {
                                    return new Spec(x.heading, x.executionIdentifier);
                                }
                            }));
                        }
                    );
            }
        });
    }

    private shouldRefresh(fileUri: vscode.Uri): boolean {
        return extensions.includes(path.extname(fileUri.fsPath)) &&
            this.gaugeWorkspace.getClientsMap().get(fileUri.fsPath).project.root() === this.activeFolder;
    }

    changeClient(projectPath: string) {
        setCommandContext(GaugeCommandContext.Activated, false);
        if (isSpecExplorerEnabled()) {
            this.activateTreeDataProvider(projectPath);
        }
    }

    private activateTreeDataProvider(projectPath: string) {
        if (!projectPath) return;
        const workspacePath = Uri.file(projectPath).fsPath;
        const client = this.gaugeWorkspace.getClientsMap().get(workspacePath).client;
        if (!client) return;
        client.onReady().then(() => {
            this._languageClient = client;
            this.activeFolder = projectPath;
            this.refresh();
            setTimeout(setCommandContext, 1000, GaugeCommandContext.Activated, true);
        }).catch((reason) => {
            window.showErrorMessage("Failed to create test explorer.", reason);
        });
    }

    private showDocumentWithSelection(node: GaugeNode): (value: TextDocument) => TextEditor | Thenable<TextEditor> {
        return (document) => {
            if (node instanceof Scenario) {
                let scenarioNode: Scenario = node;
                let options: TextDocumentShowOptions = {
                    selection: new Range(new Position(scenarioNode.lineNo - 1, 0),
                        new Position(scenarioNode.lineNo - 1, 0))
                };
                return window.showTextDocument(document, options);
            }
            if (node instanceof Spec) {
                let options: TextDocumentShowOptions = {
                    selection: new Range(new Position(0, 0), new Position(0, 0))
                };
                return window.showTextDocument(document, options);
            }
            return window.showTextDocument(document);
        };
    }
}

export abstract class GaugeNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly file: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }
    command = { title: 'Open File', command: GaugeVSCodeCommands.Open, arguments: [this] };
}

export class Spec extends GaugeNode {
    constructor(
        public readonly label: string,
        public readonly file: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed, file);
    }

    contextValue = 'specification';
}

export class Scenario extends GaugeNode {

    constructor(
        public readonly label: string,
        public readonly file: string,
        public readonly lineNo: number,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None, file);
    }

    readonly executionIdentifier = this.file + ":" + this.lineNo;

    contextValue = 'scenario';
}

function isSpecExplorerEnabled(): boolean {
    let specExplorerConfig = workspace.getConfiguration('gauge.specExplorer');
    return specExplorerConfig && specExplorerConfig.get<boolean>('enabled');
}