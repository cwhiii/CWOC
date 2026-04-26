"""Unit tests for vcard_parse and vcard_print."""
import sys
import os

# Allow importing main from the backend directory
sys.path.insert(0, os.path.dirname(__file__))

from main import vcard_parse, vcard_print, compute_display_name


def test_basic_round_trip():
    """A full contact round-trips through print → parse → print."""
    contact = {
        "given_name": "John",
        "surname": "Doe",
        "middle_names": "Michael",
        "prefix": "Dr.",
        "suffix": "Jr.",
        "phones": [{"label": "Work", "value": "+1-555-0100"}, {"label": "Mobile", "value": "+1-555-0200"}],
        "emails": [{"label": "Home", "value": "john@example.com"}],
        "addresses": [{"label": "Home", "value": "123 Main St, Anytown, NY, 10001, US"}],
        "websites": [{"label": "Work", "value": "https://example.com"}],
        "call_signs": [{"label": "Ham", "value": "KD2ABC"}],
        "x_handles": [{"label": "X", "value": "@johndoe"}],
        "has_signal": True,
        "pgp_key": "ABCDEF1234567890",
        "favorite": False,
    }

    vcard_str = vcard_print(contact)
    parsed = vcard_parse(vcard_str)
    vcard_str2 = vcard_print(parsed)

    assert vcard_str == vcard_str2, f"Round-trip mismatch:\n{vcard_str}\n---\n{vcard_str2}"


def test_parse_standard_vcard():
    """Parse a standard vCard 3.0 string."""
    vcard = (
        "BEGIN:VCARD\r\n"
        "VERSION:3.0\r\n"
        "N:Smith;Jane;Marie;Ms.;Ph.D.\r\n"
        "FN:Ms. Jane Marie Smith Ph.D.\r\n"
        "TEL;TYPE=Home:+1-555-1234\r\n"
        "EMAIL;TYPE=Work:jane@work.com\r\n"
        "ADR;TYPE=Work:;;456 Oak Ave;Springfield;IL;62704;US\r\n"
        "URL;TYPE=Blog:https://jane.blog\r\n"
        "X-SIGNAL:true\r\n"
        "X-PGP-KEY:DEADBEEF\r\n"
        "X-CALLSIGN;TYPE=Ham:W1AW\r\n"
        "X-XHANDLE;TYPE=X:@janesmith\r\n"
        "END:VCARD"
    )
    c = vcard_parse(vcard)
    assert c["given_name"] == "Jane"
    assert c["surname"] == "Smith"
    assert c["middle_names"] == "Marie"
    assert c["prefix"] == "Ms."
    assert c["suffix"] == "Ph.D."
    assert len(c["phones"]) == 1
    assert c["phones"][0]["label"] == "Home"
    assert c["phones"][0]["value"] == "+1-555-1234"
    assert c["emails"][0]["value"] == "jane@work.com"
    assert c["addresses"][0]["label"] == "Work"
    assert "456 Oak Ave" in c["addresses"][0]["value"]
    assert c["websites"][0]["value"] == "https://jane.blog"
    assert c["has_signal"] is True
    assert c["pgp_key"] == "DEADBEEF"
    assert c["call_signs"][0]["value"] == "W1AW"
    assert c["x_handles"][0]["value"] == "@janesmith"


def test_print_minimal_contact():
    """Print a contact with only a given name."""
    contact = {"given_name": "Alice"}
    vcard_str = vcard_print(contact)
    assert "BEGIN:VCARD" in vcard_str
    assert "VERSION:3.0" in vcard_str
    assert "N:;Alice;;;" in vcard_str
    assert "FN:Alice" in vcard_str
    assert "END:VCARD" in vcard_str
    # No TEL, EMAIL, etc. lines
    assert "TEL" not in vcard_str
    assert "EMAIL" not in vcard_str


def test_parse_missing_fields():
    """Parse a vCard with only N and FN — multi-value fields should be None."""
    vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Solo;Han;;;\r\nFN:Han Solo\r\nEND:VCARD"
    c = vcard_parse(vcard)
    assert c["given_name"] == "Han"
    assert c["surname"] == "Solo"
    assert c["phones"] is None
    assert c["emails"] is None
    assert c["has_signal"] is False
    assert c["pgp_key"] is None


def test_parse_fn_fallback():
    """If N is missing given_name, fall back to FN."""
    vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:;;;;\r\nFN:Mystery Person\r\nEND:VCARD"
    c = vcard_parse(vcard)
    assert c["given_name"] == "Mystery Person"


def test_no_type_parameter():
    """Properties without TYPE parameter should have label=None."""
    vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:;Bob;;;\r\nTEL:+1-555-9999\r\nEND:VCARD"
    c = vcard_parse(vcard)
    assert c["phones"][0]["label"] is None
    assert c["phones"][0]["value"] == "+1-555-9999"


def test_signal_false():
    """X-SIGNAL:false should parse as has_signal=False."""
    vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:;Test;;;\r\nX-SIGNAL:false\r\nEND:VCARD"
    c = vcard_parse(vcard)
    assert c["has_signal"] is False


def test_empty_value_entries_skipped():
    """Multi-value entries with empty values should be skipped."""
    contact = {
        "given_name": "Test",
        "phones": [{"label": "Work", "value": ""}, {"label": "Home", "value": "+1-555-0000"}],
    }
    vcard_str = vcard_print(contact)
    # Only one TEL line should appear
    tel_lines = [l for l in vcard_str.split("\r\n") if l.startswith("TEL")]
    assert len(tel_lines) == 1
    assert "+1-555-0000" in tel_lines[0]


def test_address_round_trip():
    """Address formatting survives a round-trip."""
    contact = {
        "given_name": "Test",
        "addresses": [{"label": "Home", "value": "123 Main St, Anytown, NY, 10001"}],
    }
    vcard_str = vcard_print(contact)
    parsed = vcard_parse(vcard_str)
    # The parsed address should contain the original text
    assert "123 Main St" in parsed["addresses"][0]["value"]
    assert parsed["addresses"][0]["label"] == "Home"


def test_favorite_round_trip():
    """Favorite flag survives a round-trip via X-FAVORITE property."""
    contact = {
        "given_name": "Fav",
        "surname": "Person",
        "favorite": True,
    }
    vcard_str = vcard_print(contact)
    assert "X-FAVORITE:true" in vcard_str
    parsed = vcard_parse(vcard_str)
    assert parsed["favorite"] is True

    # Non-favorite should NOT emit X-FAVORITE
    contact2 = {"given_name": "Normal", "favorite": False}
    vcard_str2 = vcard_print(contact2)
    assert "X-FAVORITE" not in vcard_str2
    parsed2 = vcard_parse(vcard_str2)
    assert parsed2["favorite"] is False


if __name__ == "__main__":
    test_basic_round_trip()
    test_parse_standard_vcard()
    test_print_minimal_contact()
    test_parse_missing_fields()
    test_parse_fn_fallback()
    test_no_type_parameter()
    test_signal_false()
    test_empty_value_entries_skipped()
    test_address_round_trip()
    test_favorite_round_trip()
    print("All tests passed!")
