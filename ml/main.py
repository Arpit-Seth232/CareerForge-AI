from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import config
from routes.resume import router as resume_router
from routes.roadmap import router as roadmap_router
from routes.ml import router as ml_router

app = FastAPI(
    title="CareerForge ML Service",
    version="1.0.0",
    description="ML microservice for resume parsing, skill extraction, and career AI features",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_router)
app.include_router(roadmap_router)
app.include_router(ml_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "careerforge-ml"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
