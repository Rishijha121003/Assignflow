def test_health_endpoint_returns_200(client):
    """Verify that GET /api/health responds with HTTP 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["service"] == "AssignFlow"
    assert payload["environment"] == "development"
    assert "database" in payload
    assert payload["database"]["connected"] is True
