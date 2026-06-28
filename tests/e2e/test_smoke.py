import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost"


@pytest.fixture(scope="module")
def driver():
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    d = webdriver.Chrome(options=options)
    yield d
    d.quit()


def test_app_loads(driver):
    driver.get(BASE_URL)
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "app-root"))
    )
    assert driver.find_element(By.TAG_NAME, "app-root")


def test_products_page_loads(driver):
    driver.get(f"{BASE_URL}/products")
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "app-root"))
    )
    assert "/products" in driver.current_url


def test_api_reachable(driver):
    driver.get(f"{BASE_URL}/api/products")
    assert driver.find_element(By.TAG_NAME, "body").text != ""
