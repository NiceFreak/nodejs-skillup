import os
import pytest
from pathlib import Path
from src.config import load_env


def test_load_env_missing_file():
    before = os.environ.get("NONEXISTENT_KEY")
    load_env(Path("/path/does/not/exist/.env"))
    assert os.environ.get("NONEXISTENT_KEY") == before


def test_load_env_normal_key_value(tmp_path, monkeypatch):
    monkeypatch.delenv("NAME", raising=False)
    monkeypatch.delenv("AGE", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("NAME=test\nAGE=25")
    load_env(env_file)
    assert os.environ.get("NAME") == "test"
    assert os.environ.get("AGE") == "25"


def test_load_env_skip_empty_key(tmp_path, monkeypatch):
    monkeypatch.delenv("KEY", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("=orphan\nKEY=ok")
    load_env(env_file)
    assert os.environ.get("KEY") == "ok"
    assert "" not in os.environ


def test_load_env_strip_quotes(tmp_path, monkeypatch):
    monkeypatch.delenv("DOUBLE", raising=False)
    monkeypatch.delenv("SINGLE", raising=False)
    monkeypatch.delenv("NORMAL", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("DOUBLE=\"hello\"\nSINGLE='world'\nNORMAL=plain")
    load_env(env_file)
    assert os.environ.get("DOUBLE") == "hello"
    assert os.environ.get("SINGLE") == "world"
    assert os.environ.get("NORMAL") == "plain"


def test_load_env_setdefault_not_override_existing(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("EXISTING=from_env")
    os.environ["EXISTING"] = "already_set"
    load_env(env_file)
    assert os.environ["EXISTING"] == "already_set"


def test_load_env_ignores_comments_and_blank_lines(tmp_path, monkeypatch):
    monkeypatch.delenv("KEY", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("# comment\n\nKEY=value\n  # trailing")
    load_env(env_file)
    assert os.environ.get("KEY") == "value"
