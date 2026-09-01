import pytest

from src.users.greet import greet
from src.users.unit5_demo import create_user, UserValidationError


def test_greet_no_title():
    assert greet("小明") == "你好，小明"


def test_greet_with_title():
    assert greet("张", "博士") == "博士 张"


def test_greet_empty_title_goes_default_branch():
    assert greet("x", "") == "你好，x"


def test_create_user_rejects_bad_email():
    with pytest.raises(UserValidationError):
        create_user(email="not-an-email", name="张三")
