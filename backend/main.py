from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel
import csv
from io import StringIO

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploaded_data = []

class Query(BaseModel):
    query: str

# ✅ Health check
@app.get("/")
def home():
    return {"message": "Backend running"}

# ✅ Upload CSV
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(StringIO(decoded))

    global uploaded_data
    uploaded_data = list(reader)

    return {"message": "Uploaded successfully", "rows": len(uploaded_data)}

# ✅ Simulation logic (IMPROVED)
@app.post("/simulate")
def simulate(data: Query):
    total_cost = 0
    total_delay = 0
    impacted_routes = []

    for row in uploaded_data:
        cost = int(row.get("cost", 5000))
        route = row.get("route", "unknown")

        # 🔥 Example disruption logic
        if "la" in route.lower():
            delay = 3
            extra_cost = 1000
            impacted_routes.append(route)
        else:
            delay = 1
            extra_cost = 300

        total_cost += cost + extra_cost
        total_delay += delay

    return {
        "delay": f"{total_delay} days",
        "cost": f"${total_cost}",
        "impacted_routes": impacted_routes,
        "recommendation": "Reroute high-risk routes via alternate ports"
    }

# ✅ NEW: Routes for MAP (IMPORTANT)
@app.get("/routes")
def get_routes():
    routes = []

    for row in uploaded_data:
        try:
            route = {
                "source": [
                    float(row["source_lng"]),
                    float(row["source_lat"])
                ],
                "dest": [
                    float(row["dest_lng"]),
                    float(row["dest_lat"])
                ],
                "route_name": row.get("route", "unknown")
            }
            routes.append(route)
        except:
            continue

    return routes

# ✅ NEW: Disruption API (NEXT LEVEL)
@app.get("/disruptions")
def get_disruptions():
    disruptions = []

    for row in uploaded_data:
        route = row.get("route", "").lower()

        if "la" in route:
            disruptions.append({
                "route": route,
                "severity": "high"
            })

    return disruptions