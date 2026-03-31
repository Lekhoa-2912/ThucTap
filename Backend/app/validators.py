"""
Input Validators and Validation Decorators
"""
import re
from pydantic import validator, EmailStr
from typing import Any


class EmailValidator:
    """Email validation utilities"""
    
    EMAIL_PATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    @classmethod
    def validate(cls, email: str) -> str:
        """Validate email format"""
        if not re.match(cls.EMAIL_PATTERN, email):
            raise ValueError('Invalid email format')
        return email.lower()


class PasswordValidator:
    """Password validation utilities"""
    
    MIN_LENGTH = 8
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = False
    
    @classmethod
    def validate(cls, password: str) -> str:
        """Validate password strength"""
        errors = []
        
        # Check minimum length
        if len(password) < cls.MIN_LENGTH:
            errors.append(f'Password must be at least {cls.MIN_LENGTH} characters')
        
        # Check for uppercase
        if cls.REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append('Password must contain at least one uppercase letter')
        
        # Check for lowercase
        if cls.REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append('Password must contain at least one lowercase letter')
        
        # Check for digit
        if cls.REQUIRE_DIGIT and not re.search(r'\d', password):
            errors.append('Password must contain at least one digit')
        
        # Check for special character
        if cls.REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append('Password must contain at least one special character')
        
        if errors:
            raise ValueError('; '.join(errors))
        
        return password


class PhoneValidator:
    """Phone number validation"""
    
    @classmethod
    def validate(cls, phone: str) -> str:
        """Validate phone number format (Vietnamese format)"""
        # Remove spaces and dashes
        phone = re.sub(r'[\s\-\.]', '', phone)
        
        # Check if it's a valid Vietnamese phone
        if not re.match(r'^0\d{9,10}$', phone):
            raise ValueError('Invalid phone number format. Use format: 0xxxxxxxxx')
        
        return phone


class UserNameValidator:
    """User name validation"""
    
    MIN_LENGTH = 2
    MAX_LENGTH = 50
    PATTERN = r'^[a-zA-ZÀ-ỿ\s\-\']*$'  # Allow Vietnamese characters
    
    @classmethod
    def validate(cls, name: str) -> str:
        """Validate user full name"""
        name = name.strip()
        
        if len(name) < cls.MIN_LENGTH:
            raise ValueError(f'Name must be at least {cls.MIN_LENGTH} characters')
        
        if len(name) > cls.MAX_LENGTH:
            raise ValueError(f'Name must be at most {cls.MAX_LENGTH} characters')
        
        if not re.match(cls.PATTERN, name):
            raise ValueError('Name contains invalid characters')
        
        return name.title()  # Convert to title case


class EmployeeIdValidator:
    """Employee ID validation"""
    
    @classmethod
    def validate(cls, employee_id: str) -> str:
        """Validate employee ID format"""
        employee_id = employee_id.strip().upper()
        
        if not re.match(r'^[A-Z]{2,4}\d{3,5}$', employee_id):
            raise ValueError('Invalid employee ID format')
        
        return employee_id


class DateValidator:
    """Date validation utilities"""
    
    @classmethod
    def validate_future_date(cls, date_str: str) -> str:
        """Validate that date is in the future"""
        from datetime import datetime
        
        try:
            date = datetime.fromisoformat(date_str)
            if date <= datetime.utcnow():
                raise ValueError('Date must be in the future')
            return date_str
        except ValueError as e:
            raise ValueError(f'Invalid date format: {str(e)}')
    
    @classmethod
    def validate_date_range(cls, start_date: str, end_date: str) -> tuple:
        """Validate date range"""
        from datetime import datetime
        
        try:
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            
            if start >= end:
                raise ValueError('Start date must be before end date')
            
            return start_date, end_date
        except ValueError as e:
            raise ValueError(f'Invalid date format: {str(e)}')


class StrongPasswordMixin:
    """Mixin for models that have password field"""
    
    @validator('password')
    def validate_password(cls, v):
        return PasswordValidator.validate(v)


class EmailFieldMixin:
    """Mixin for models that have email field"""
    
    @validator('email')
    def validate_email(cls, v):
        return EmailValidator.validate(v)


class PhoneFieldMixin:
    """Mixin for models that have phone field"""
    
    @validator('phone')
    def validate_phone(cls, v):
        if v:
            return PhoneValidator.validate(v)
        return v


class NameFieldMixin:
    """Mixin for models that have full_name field"""
    
    @validator('full_name')
    def validate_name(cls, v):
        return UserNameValidator.validate(v)


# Compound Validators
def validate_new_user_data(data: dict) -> dict:
    """Validate complete user registration data"""
    errors = {}
    
    try:
        if 'email' in data:
            data['email'] = EmailValidator.validate(data['email'])
    except ValueError as e:
        errors['email'] = str(e)
    
    try:
        if 'password' in data:
            data['password'] = PasswordValidator.validate(data['password'])
    except ValueError as e:
        errors['password'] = str(e)
    
    try:
        if 'full_name' in data:
            data['full_name'] = UserNameValidator.validate(data['full_name'])
    except ValueError as e:
        errors['full_name'] = str(e)
    
    try:
        if 'phone' in data and data['phone']:
            data['phone'] = PhoneValidator.validate(data['phone'])
    except ValueError as e:
        errors['phone'] = str(e)
    
    if errors:
        raise ValueError(f"Validation errors: {errors}")
    
    return data
