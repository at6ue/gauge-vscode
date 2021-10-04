from os import environ

from getgauge.python import step


@step("<key> is loaded")
def key_is_loaded(key):
    assert environ.get(key) != None

@step("<key> is not loaded")
def key_is_not_loaded(key):
    assert environ.get(key) == None
