"""
Custom Exceptions for GoodZWork API
"""
from fastapi import HTTPException
from typing import Any, Optional, Dict

class AppException(HTTPException):
    """Base custom exception for the application"""
    
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        self.code = code
        self.details = details or {}
        super().__init__(
            status_code=status_code,
            detail=message
        )


# Authentication Exceptions
class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(
            status_code=401,
            code="UNAUTHORIZED",
            message=message
        )


class InvalidCredentialsException(AppException):
    def __init__(self, message: str = "Invalid email or password"):
        super().__init__(
            status_code=401,
            code="INVALID_CREDENTIALS",
            message=message
        )


class TokenExpiredException(AppException):
    def __init__(self, message: str = "Token has expired"):
        super().__init__(
            status_code=401,
            code="TOKEN_EXPIRED",
            message=message
        )


# Authorization Exceptions
class ForbiddenException(AppException):
    def __init__(self, message: str = "You don't have permission"):
        super().__init__(
            status_code=403,
            code="FORBIDDEN",
            message=message
        )


# Not Found Exceptions
class ResourceNotFoundException(AppException):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            status_code=404,
            code="NOT_FOUND",
            message=f"{resource} with id {resource_id} not found",
            details={"resource": resource, "resource_id": resource_id}
        )


class UserNotFoundException(ResourceNotFoundException):
    def __init__(self, user_id: str):
        super().__init__("User", user_id)


# Validation Exceptions
class ValidationException(AppException):
    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(
            status_code=422,
            code="VALIDATION_ERROR",
            message=message,
            details=details
        )


class DuplicateEmailException(ValidationException):
    def __init__(self, email: str):
        super().__init__(
            message=f"Email {email} already exists",
            details={"field": "email", "value": email}
        )


class InvalidPasswordException(ValidationException):
    def __init__(self, message: str = "Password does not meet requirements"):
        super().__init__(message=message)


# Business Logic Exceptions
class BusinessException(AppException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Dict[str, Any] = None
    ):
        super().__init__(status_code, code, message, details)


class LocationOutOfBoundsException(BusinessException):
    def __init__(self, distance: float, allowed: float):
        super().__init__(
            status_code=400,
            code="LOCATION_OUT_OF_BOUNDS",
            message=f"Your location is {distance:.0f}m away from office (allowed: {allowed}m)",
            details={"distance": distance, "allowed": allowed}
        )


class AlreadyCheckedInException(BusinessException):
    def __init__(self):
        super().__init__(
            status_code=400,
            code="ALREADY_CHECKED_IN",
            message="You have already checked in today"
        )


class NoCheckInException(BusinessException):
    def __init__(self):
        super().__init__(
            status_code=400,
            code="NO_CHECK_IN",
            message="You must check in before checking out"
        )


# Server Exceptions
class InternalServerException(AppException):
    def __init__(self, message: str = "Internal server error"):
        super().__init__(
            status_code=500,
            code="INTERNAL_ERROR",
            message=message
        )


class DatabaseException(InternalServerException):
    def __init__(self, message: str = "Database error occurred"):
        super().__init__(message)


class ExternalServiceException(InternalServerException):
    def __init__(self, service: str, message: str = "External service error"):
        super().__init__(f"Error calling {service}: {message}")
