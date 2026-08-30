from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles


router = APIRouter(
    prefix="/api/datasets",
    tags=["Datasets"],
)


@router.get(
    "/",
    response_model=List[schemas.UploadedDatasetOut],
)
def list_datasets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(models.UploadedDataset)
        .filter(
            models.UploadedDataset.business_id
            == current_user.business_id
        )
        .order_by(
            models.UploadedDataset.upload_date.desc()
        )
        .all()
    )


@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "admin",
        )
    ),
):
    dataset = (
        db.query(models.UploadedDataset)
        .filter(
            models.UploadedDataset.id == dataset_id,
            models.UploadedDataset.business_id
            == current_user.business_id,
        )
        .first()
    )

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found",
        )

    db.delete(dataset)
    db.commit()

    return {
        "message": "Dataset deleted successfully"
    }