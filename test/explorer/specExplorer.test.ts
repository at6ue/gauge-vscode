import assert = require('assert');
import * as path from 'path';
import { capture, instance, mock } from 'ts-mockito';
import { commands } from 'vscode';
import { GaugeVSCodeCommands } from '../../src/constants';
import { GaugeExecutor } from '../../src/execution/gaugeExecutor';
import { Scenario, Spec } from '../../src/explorer/specExplorer';

const specFilePath = path.join(__dirname, '..', '..', '..', 'test', 'testdata', 'sampleProject', 'specs', 'example.spec');

suite('Spec Explorer Tests', () => {
    const spec = new Spec('', specFilePath);
    const scenario = new Scenario('', specFilePath, 6);
    const mockExecutor = mock(GaugeExecutor);
    const executor = instance(mockExecutor);

    test('should run given specification node', async () => {
        const status = await commands.executeCommand(GaugeVSCodeCommands.ExecuteNode, spec);
        assert.strictEqual(status, true);
    });

    test('[MOCK]should run given specification node', async () => {
        await commands.executeCommand(GaugeVSCodeCommands.ExecuteNode, spec, executor);
        const [target, config] = capture(mockExecutor.execute).last()
        assert.strictEqual(target, spec.file);
        assert.strictEqual(config.getDebug(), false);
    });

    // Fail because the test cannot wait for the debugger to detach
    test.skip('should debug given specification node', async () => {
        const status = await commands.executeCommand(GaugeVSCodeCommands.DebugNode, spec);
        assert.strictEqual(status, true);
    });

    test('[MOCK]should debug given specification node', async () => {
        await commands.executeCommand(GaugeVSCodeCommands.DebugNode, spec, executor);
        const [target, config] = capture(mockExecutor.execute).last()
        assert.strictEqual(target, spec.file);
        assert.strictEqual(config.getDebug(), true);
    });


    // Following scenario node tests will fail or work wrong after pack, because the Scenario class here is not the same as the one in extension.js.

    test('should run given scenario node', async () => {
        const status = await commands.executeCommand(GaugeVSCodeCommands.ExecuteNode, scenario);
        assert.strictEqual(status, true);
    });

    test('[MOCK]should run given scenario node', async () => {
        await commands.executeCommand(GaugeVSCodeCommands.ExecuteNode, scenario, executor);
        const [target, config] = capture(mockExecutor.execute).last()
        assert.strictEqual(target, scenario.executionIdentifier);
        assert.strictEqual(config.getDebug(), false);
    });

    // Fail because the test cannot wait for the debugger to detach
    test.skip('should debug given scenario node', async () => {
        const status = await commands.executeCommand(GaugeVSCodeCommands.DebugNode, scenario);
        assert.strictEqual(status, true);
    });

    test('[MOCK]should debug given scenario node', async () => {
        await commands.executeCommand(GaugeVSCodeCommands.DebugNode, scenario, executor);
        const [target, config] = capture(mockExecutor.execute).last()
        assert.strictEqual(target, scenario.executionIdentifier);
        assert.strictEqual(config.getDebug(), true);
    });

});
