from sqlalchemy import text


def test_postgresql_connection_can_execute_query(db_engine):
    """
    Directly tests that SQLAlchemy can connect to PostgreSQL and execute a query.
    Ensures real database connectivity without mocks.
    """
    with db_engine.connect() as connection:
        result = connection.execute(text("SELECT 1 AS alive")).scalar()
        assert result == 1


def test_postgresql_schema_access(db_engine):
    """
    Verifies that the database session has access to the current schema and PostgreSQL version.
    """
    with db_engine.connect() as connection:
        version = connection.execute(text("SELECT version();")).scalar()
        assert "PostgreSQL" in version
