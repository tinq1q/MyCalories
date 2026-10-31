from app.base_products import load_base_products


def test_base_products_valid_and_large_enough():
    products = load_base_products()
    assert len(products) >= 80
    assert len({p.id for p in products}) == len(products)
    assert all(p.source == "base" and p.portionG and p.portionG > 0 for p in products)
    assert all(
        abs(p.kcal - (4 * p.protein + 9 * p.fat + 4 * p.carbs)) <= 0.25 * p.kcal + 15
        for p in products
    )
    assert all(p.id.startswith("base-") for p in products)


def test_base_contains_buckwheat(client):
    data = client.get("/api/products/base").json()
    b = next(p for p in data if p["id"] == "base-buckwheat-boiled")
    assert b == {
        "id": "base-buckwheat-boiled",
        "name": "Гречка варёная",
        "kcal": 110,
        "protein": 4.2,
        "fat": 1.1,
        "carbs": 21.3,
        "portionG": 150,
        "source": "base",
    }
