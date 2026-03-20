from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.roadmap import generate_roadmap

router = APIRouter(prefix="/api/v1/roadmap", tags=["Roadmap"])


class RoadmapGenerateRequest(BaseModel):
    user_id: str
    target_role: str


@router.post("/generate")
async def generate_career_roadmap(body: RoadmapGenerateRequest):
    try:
        result = await generate_roadmap(
            user_id=body.user_id,
            target_role=body.target_role,
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Roadmap generation failed: {e}")
