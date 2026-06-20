from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class SyncOperationPayload(BaseModel):
    operation_id: UUID
    entity_type: str  # product, sale, inventory_movement, cash_register
    entity_id: UUID
    operation: str  # create, update, delete
    payload: Dict[str, Any]


class SyncPushRequest(BaseModel):
    operations: List[SyncOperationPayload]


class SyncPushResponse(BaseModel):
    processed: int
    failed: int


class PullChange(BaseModel):
    id: str
    entity_type: str
    entity_id: UUID
    operation: str
    payload: Dict[str, Any]
    created_at: datetime


class SyncPullResponse(BaseModel):
    changes: List[PullChange]
    server_time: datetime
