from seleniumbase import SB
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import re


def get_google_reviews(company, max_reviews=200, include_meta=False, wait_secs=2, scroll_pause=2.5, max_stagnant=5):
    """
    Scrape Google Maps reviews for a given company.

    Parameters
    ----------
    company : object
        Must expose .COMPANY_NAME and optionally .GOOGLE_RVW_LINK.
    max_reviews : int, default=200
        Minimum number of reviews to attempt before stopping (if available).
    include_meta : bool, default=False
        If True, return list of dicts with text/rating/reviewer/date.
        If False, return list of review text strings (backward compatible).
    wait_secs : int
        Max wait for key elements.
    scroll_pause : float
        Pause between scroll attempts (seconds).
    max_stagnant : int
        Stop after this many consecutive scrolls with no new reviews loaded.

    Returns
    -------
    list
        If include_meta=False: list[str]
        If include_meta=True:  list[dict]
    """

    # Get company name - use VEND_TITL as primary field
    company_name = getattr(company, "VEND_TITL", None)
    company_address = getattr(company, "VEND_CON_ADDR", None)
    
    # Handle cases where VEND_TITL is None or empty
    if not company_name or company_name.strip() == "":
        # Try alternative field names
        company_name = (getattr(company, "COMPANY_NAME", None) or 
                       getattr(company, "NAME", None) or 
                       getattr(company, "VENDOR_NAME", None) or 
                       getattr(company, "BUSINESS_NAME", None) or 
                       f"Company_{getattr(company, 'VEND_ID', 'Unknown')}")
        print(f"[SCRAPER] VEND_TITL was None/empty, using alternative: {company_name}")
    
    # Combine company name with address for better search accuracy
    search_term = company_name
    if company_address and company_address.strip():
        search_term = f"{company_name}, {company_address.strip()}"
        print(f"[SCRAPER] Using combined search term: {search_term}")
    else:
        print(f"[SCRAPER] No address found (VEND_CON_ADDR), using name only: {search_term}")
    
    google_review_link = getattr(company, "GOOGLE_RVW_LINK", None)
    print(f"[SCRAPER] Attempting to scrape reviews for: {company_name!r}")
    
    # Validate that we have a usable search term
    if not search_term or len(search_term.strip()) < 2:
        print(f"[SCRAPER] ERROR: Search term '{search_term}' is too short or empty. Cannot search.")
        return []

    results = []  # will store dicts internally; convert to text-only if include_meta=False

    # --- SeleniumBase session ---
    with SB(uc=True, test=False, headless=False) as sb:
        driver = sb.driver
        if not driver:
            raise RuntimeError("[SCRAPER] SeleniumBase driver did not initialize properly.")

        wait = WebDriverWait(driver, wait_secs)

        # ------------------------------------------------------------------
        # STEP 1: Open a direct reviews link OR search in Google Maps
        # ------------------------------------------------------------------
        if google_review_link and google_review_link != 'Not Available':
            print(f"[SCRAPER] Using provided Google review link: {google_review_link}")
            sb.open(google_review_link)
            # Give the page a moment to settle
            time.sleep(2)
        else:
            print(f"[SCRAPER] Searching Google Maps for: {company_name}")
            sb.open("https://www.google.com/maps")

            # Consent popups vary by region
            try:
                # Try some common consent button text variations
                consent_selectors = [
                    "//button[contains(., 'Accept all')]",
                    "//button[contains(., 'I agree')]",
                    "//button[contains(., 'Accept')]",
                ]
                for xp in consent_selectors:
                    try:
                        btn = wait.until(EC.element_to_be_clickable((By.XPATH, xp)))
                        btn.click()
                        time.sleep(1)
                        break
                    except Exception:
                        continue
            except Exception:
                pass  # ignore if no consent

            # Enter search term (company name + address for better accuracy)
            try:
                search_box = wait.until(EC.element_to_be_clickable((By.ID, "searchboxinput")))
                search_box.clear()
                search_box.send_keys(search_term)
                search_box.send_keys(Keys.ENTER)
                print(f"[SCRAPER] Submitted search for: {search_term}")
                time.sleep(2)  # allow results load
            except Exception:
                print("[SCRAPER] Search box not found after waiting.")
                return []

        # Robustly click the 'Reviews' tab after the page is loaded
        reviews_button_clicked = False
        scrollable_div = None
        for attempt in range(3):
            try:
                # Try button with text 'Reviews'
                reviews_tab = None
                try:
                    reviews_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space(text())='Reviews']")))
                except Exception:
                    pass
                # If not found, try div with text 'Reviews'
                if not reviews_tab:
                    try:
                        reviews_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[normalize-space(text())='Reviews']")))
                    except Exception:
                        pass
                if reviews_tab and reviews_tab.is_displayed() and reviews_tab.is_enabled():
                    reviews_tab.click()
                    print("[SCRAPER] Clicked 'Reviews' tab.")
                    time.sleep(4)
                    # Wait for the scrollable reviews container to appear
                    scrollable_div = _locate_reviews_container(sb, wait)
                    if scrollable_div:
                        print("[SCRAPER] Reviews modal is open and scrollable container found.")
                        reviews_button_clicked = True
                        break
                    else:
                        print("[SCRAPER] Reviews modal did not open, retrying...")
                else:
                    print("[SCRAPER] 'Reviews' tab not found or not clickable, retrying...")
            except Exception as e:
                print(f"[SCRAPER] Attempt {attempt+1}: Could not find or click 'Reviews' tab: {e}")
                time.sleep(2)
        if not reviews_button_clicked:
            print(f"[SCRAPER] Failed to find/click 'Reviews' tab after 3 attempts.")
            return []

        # After opening the reviews modal, try to click 'More reviews' if present
        try:
            more_reviews_btn = driver.find_element(By.XPATH, "//button[normalize-space(text())='More reviews']")
            if more_reviews_btn.is_displayed() and more_reviews_btn.is_enabled():
                more_reviews_btn.click()
                print("[SCRAPER] Clicked 'More reviews' button.")
                time.sleep(2)
        except Exception:
            pass

        # ------------------------------------------------------------------
        # STEP 3: Locate the scrollable reviews container
        # ------------------------------------------------------------------
        # scrollable_div is already set above
        if not scrollable_div:
            scrollable_div = _locate_reviews_container(sb, wait)
        if not scrollable_div:
            print("[SCRAPER] Could not locate reviews scroll container. Aborting.")
            return []

        # ------------------------------------------------------------------
        # STEP 4: Scrolling & collection loop
        # ------------------------------------------------------------------
        seen_ids = set()      # to prevent duplicates
        stagnant_scrolls = 0
        last_count = 0

        while True:
            # Collect currently visible review cards
            new_items = _collect_reviews_from_dom(sb, include_meta, seen_ids)
            results.extend(new_items)

            # Check stop conditions
            if len(results) >= max_reviews:
                print(f"[SCRAPER] Reached requested max_reviews ({max_reviews}).")
                break

            if len(results) == last_count:
                stagnant_scrolls += 1
            else:
                stagnant_scrolls = 0

            last_count = len(results)
            print(f"[SCRAPER] Reviews collected so far: {last_count} (stagnant={stagnant_scrolls}/{max_stagnant})")

            if stagnant_scrolls >= max_stagnant:
                print("[SCRAPER] No new reviews after repeated scrolls. Assuming end of list.")
                break

            # Scroll to bottom of container
            try:
                driver.execute_script("arguments[0].scrollTo(0, arguments[0].scrollHeight);", scrollable_div)
            except Exception as e:
                print(f"[SCRAPER] Scroll JS error: {e}")
                break

            time.sleep(scroll_pause)

            # Re-acquire container occasionally to avoid stale element
            try:
                scrollable_div = _locate_reviews_container(sb, wait, quick=True) or scrollable_div
            except Exception:
                pass

        print(f"[SCRAPER] Finished. Total reviews collected: {len(results)}")

    # ----------------------------------------------------------------------
    # STEP 5: Return shape requested
    # ----------------------------------------------------------------------
    if include_meta:
        return results
    else:
        # Return list of text only
        return [r["text"] for r in results if r.get("text")]


# --------------------------------------------------------------------------
# Helper: locate reviews scroll container
# --------------------------------------------------------------------------
def _locate_reviews_container(sb, wait, quick=False):
    """
    Try multiple selectors that commonly match the scrollable reviews pane.
    Returns the WebElement or None.
    """
    driver = sb.driver
    timeout = 5 if quick else 20
    local_wait = WebDriverWait(driver, timeout)

    # ordered list of XPaths / CSS tries
    candidates = [
        # Common reviews list container in Maps overlay
        (By.XPATH, '//div[contains(@class,"m6QErb") and contains(@class,"DxyBCb") and contains(@class,"qjESne")]'),
        (By.XPATH, '//div[contains(@class,"m6QErb") and contains(@class,"DxyBCb")]'),
        (By.CSS_SELECTOR, 'div.m6QErb.DxyBCb'),  # CSS fallback
        # Generic region/main roles as last resort
        (By.XPATH, '//div[@role="region"]'),
        (By.XPATH, '//div[@role="main"]//div[contains(@class,"m6QErb")]'),
    ]

    for by_, sel in candidates:
        try:
            el = local_wait.until(EC.presence_of_element_located((by_, sel)))
            if el:
                return el
        except Exception:
            continue
    return None


# --------------------------------------------------------------------------
# Helper: expand truncated review text & parse review cards
# --------------------------------------------------------------------------
def _collect_reviews_from_dom(sb, include_meta, seen_ids):
    """
    Parse all currently loaded review cards.
    Expands truncated reviews when 'More' buttons are present.
    Deduplicates using card element IDs or text hash.

    Returns list of new review dicts.
    """
    driver = sb.driver
    new_records = []

    # Review card containers usually have class jftiEf or 'gws-localreviews__google-review'
    card_selectors = [
        'div.jftiEf',  # most common
        'div.gws-localreviews__google-review',  # alt
    ]

    card_elements = []
    for sel in card_selectors:
        try:
            card_elements = driver.find_elements(By.CSS_SELECTOR, sel)
            if card_elements:
                break
        except Exception:
            continue

    if not card_elements:
        return new_records

    for card in card_elements:
        # Each card: we try to create a stable ID using its WebElement id or innerHTML
        try:
            card_html = card.get_attribute("innerHTML") or ""
            card_id = hash(card_html)
        except Exception:
            card_id = id(card)

        if card_id in seen_ids:
            continue

        # Expand truncated review if needed
        _expand_card_if_truncated(driver, card)

        # Extract text
        text = ""
        try:
            # Full expanded review span
            txt_el = card.find_element(By.CSS_SELECTOR, 'span.wiI7pd')
            text = txt_el.text.strip()
            text = re.sub(r'\*+', '', text)  # Remove all * and ** symbols
        except Exception:
            # Some variants
            try:
                txt_el = card.find_element(By.CSS_SELECTOR, 'span.review-full-text')
                text = txt_el.text.strip()
                text = re.sub(r'\*+', '', text)  # Remove all * and ** symbols
            except Exception:
                pass

        # Extract metadata if requested
        rating_val = None
        reviewer_name = None
        review_date = None

        if include_meta:
            # Rating (aria-label like "5 star rating")
            try:
                star_el = card.find_element(By.CSS_SELECTOR, 'span.kvMYJc')
                aria = star_el.get_attribute("aria-label") or ""
                # parse first float
                rating_val = _parse_rating_from_aria(aria)
            except Exception:
                pass

            # Reviewer name
            try:
                reviewer_el = card.find_element(By.CSS_SELECTOR, 'div.d4r55')
                reviewer_name = reviewer_el.text.strip()
            except Exception:
                pass

            # Date text (relative: "a month ago") - robust extraction
            date_selectors = [
                'span.PuaHbe',
                'span.rsqaWe',
                'span.dehysf',
                'span.gxMdQe',
                'span',  # fallback: any span
            ]
            for sel in date_selectors:
                try:
                    date_el = card.find_element(By.CSS_SELECTOR, sel)
                    date_txt = date_el.text.strip()
                    # Heuristic: look for text like 'ago', 'year', 'month', 'week', 'day', 'hour', 'minute'
                    if any(x in date_txt.lower() for x in ['ago', 'year', 'month', 'week', 'day', 'hour', 'minute']):
                        review_date = date_txt
                        break
                except Exception:
                    continue
            # If still not found, try by XPath for common patterns
            if not review_date:
                try:
                    date_el = card.find_element(By.XPATH, ".//*[contains(text(),'ago') or contains(text(),'year') or contains(text(),'month') or contains(text(),'week') or contains(text(),'day') or contains(text(),'hour') or contains(text(),'minute')]")
                    review_date = date_el.text.strip()
                except Exception:
                    pass

        # Only add if we have some content
        if text or include_meta:
            new_records.append({
                "text": text,
                "rating": rating_val,
                "reviewer": reviewer_name,
                "date": review_date,
            })
            seen_ids.add(card_id)

    return new_records


def _expand_card_if_truncated(driver, card):
    """
    If a review is truncated, click its 'More' / expand button within the card.
    Safe no-op if not present.
    """
    # Common 'More' button in review card
    expand_selectors = [
        (By.CSS_SELECTOR, 'button.w8nwRe'),
        (By.CSS_SELECTOR, 'button[jsaction*="pane.review.expandReview"]'),
        (By.XPATH, './/button[contains(., "More")]'),
    ]
    for by_, sel in expand_selectors:
        try:
            btn = card.find_element(by_, sel)
            if btn.is_displayed() and btn.is_enabled():
                btn.click()
                time.sleep(0.1)
                return
        except Exception:
            continue


def _parse_rating_from_aria(aria_label):
    """
    Parse rating (float) from aria-label text like '5 star rating' or '4.3 stars'.
    Returns float or None.
    """
    if not aria_label:
        return None
    import re
    m = re.search(r'(\d+(?:\.\d+)?)', aria_label)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            return None
    return None
