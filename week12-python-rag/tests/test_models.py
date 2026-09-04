import pytest
from pydantic import ValidationError
from src.users.models import UserCreate


def test_user_create_valid_required_fields():
    u = UserCreate(name="张三", email="zhangsan@work.com")
    assert u.name == "张三"
    assert u.email == "zhangsan@work.com"
    assert u.role == "member"
    assert u.age is None
    assert u.addresses is None


def test_user_create_with_optional_fields():
    """Address 模型有 5 个必填字段：recipient, phone, province, city, detailAddress"""
    u = UserCreate(
        name="李四",
        email="lisi@work.com",
        age=30,
        role="admin",
        addresses=[
            {
                "recipient": "李四",
                "phone": "13800138000",
                "province": "广东省",
                "city": "深圳市",
                "detailAddress": "南山区科技园123号",
            }
        ],
    )
    assert u.age == 30
    assert u.role == "admin"
    assert len(u.addresses) == 1
    addr = u.addresses[0]
    assert addr.recipient == "李四"
    assert addr.phone == "13800138000"
    assert addr.province == "广东省"
    assert addr.city == "深圳市"
    assert addr.detailAddress == "南山区科技园123号"


def test_user_create_invalid_email():
    with pytest.raises(ValidationError) as exc:
        UserCreate(name="王五", email="not-an-email")
    # 验证错误定位到 email 字段
    errors = exc.value.errors()
    assert any(e["loc"][0] == "email" for e in errors)


def test_user_create_invalid_role():
    with pytest.raises(ValidationError):
        UserCreate(name="赵六", email="zhao@work.com", role="superadmin")


def test_user_create_serialization_roundtrip():
    original = UserCreate(name="test", email="test@example.com", age=25)
    dumped = original.model_dump()
    reloaded = UserCreate(**dumped)
    assert reloaded == original
