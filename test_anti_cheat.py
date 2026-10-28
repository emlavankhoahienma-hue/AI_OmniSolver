#!/usr/bin/env python3
import time, json, hmac, hashlib, base64, uuid

SECRET_HEX = "8f3d1a4c9b2e7f0156d8c4a3b7e9f2014d5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b"
SECRET_BYTES = bytes.fromhex(SECRET_HEX)
ZALO_CONTACT = "0344197212"

def generate_key(duration_seconds, device_id="ANY", key_id=None):
    if not key_id:
        key_id = uuid.uuid4().hex[:8].upper()
    now = int(time.time())
    exp = 9999999999 if duration_seconds is None else now + int(duration_seconds)
    payload_obj = {"exp": exp, "dev": device_id.strip() or "ANY", "id": key_id}
    payload_bytes = json.dumps(payload_obj, separators=(',', ':')).encode('utf-8')
    
    keystream = hashlib.sha256(SECRET_BYTES + b":KEYSTREAM").digest()
    obf_payload = bytes(b ^ keystream[i % len(keystream)] for i, b in enumerate(payload_bytes))
    p_b64 = base64.urlsafe_b64encode(obf_payload).decode('utf-8').rstrip('=')
    sig = hmac.new(SECRET_BYTES, p_b64.encode('utf-8'), hashlib.sha256).hexdigest()[:16]
    return f"OMNI-{p_b64}-{sig}", exp, payload_obj

def verify_and_decrypt(key_str, current_time, device_id="ANY", network_time=None, last_max_time=0, revoked_list=None):
    if not key_str or not key_str.startswith("OMNI-"):
        return False, f"⚠️ Key chưa kích hoạt, đã hết hạn hoặc không hợp lệ! Liên hệ Admin để mua Key - Zalo: {ZALO_CONTACT}", None
    
    parts = key_str.split('-')
    if len(parts) != 3:
        return False, f"⚠️ Key chưa kích hoạt, đã hết hạn hoặc không hợp lệ! Liên hệ Admin để mua Key - Zalo: {ZALO_CONTACT}", None
    
    _, p_b64, sig = parts
    
    # Layer 1: HMAC-SHA256 Anti-Tamper check
    expected_sig = hmac.new(SECRET_BYTES, p_b64.encode('utf-8'), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected_sig):
        return False, f"⚠️ Key chưa kích hoạt, đã hết hạn hoặc không hợp lệ! Liên hệ Admin để mua Key - Zalo: {ZALO_CONTACT}", None
    
    try:
        rem = len(p_b64) % 4
        padded_b64 = p_b64 + ('=' * (4 - rem) if rem else '')
        obf_payload = base64.urlsafe_b64decode(padded_b64)
        keystream = hashlib.sha256(SECRET_BYTES + b":KEYSTREAM").digest()
        payload_bytes = bytes(b ^ keystream[i % len(keystream)] for i, b in enumerate(obf_payload))
        data = json.loads(payload_bytes.decode('utf-8'))
    except Exception:
        return False, f"⚠️ Key chưa kích hoạt, đã hết hạn hoặc không hợp lệ! Liên hệ Admin để mua Key - Zalo: {ZALO_CONTACT}", None
        
    exp = data.get("exp", 0)
    dev = data.get("dev", "ANY")
    kid = data.get("id", "")
    
    # Layer 5: Remote Kill-Switch / Blacklist
    if revoked_list and kid in revoked_list:
        return False, f"⚠️ Key [{kid}] đã bị Admin thu hồi từ xa! Liên hệ Admin - Zalo: {ZALO_CONTACT}", None
        
    # Layer 3: Anti-Clock-Rollback
    effective_now = current_time
    if network_time:
        if current_time < (network_time - 300):
            return False, f"⚠️ Phát hiện vặn lùi ngày giờ hệ thống! Liên hệ Admin - Zalo: {ZALO_CONTACT}", None
        effective_now = max(current_time, network_time)
        
    if effective_now < last_max_time:
        return False, f"⚠️ Phát hiện vặn lùi ngày giờ hệ thống! Liên hệ Admin - Zalo: {ZALO_CONTACT}", None
        
    if effective_now > exp:
        return False, f"⚠️ Key chưa kích hoạt, đã hết hạn hoặc không hợp lệ! Liên hệ Admin để mua Key - Zalo: {ZALO_CONTACT}", None
        
    # Layer 4: Device Binding / HWID Lock
    if dev != "ANY" and device_id != "ANY" and dev != device_id:
        return False, f"⚠️ Key bị khóa vào thiết bị khác ({dev})! Liên hệ Admin - Zalo: {ZALO_CONTACT}", None
        
    # Layer 2: Cryptographic Execution Coupling (Derive Decryption Key)
    derived_cipher_key = hashlib.sha256(SECRET_BYTES + sig.encode('utf-8')).digest()
    return True, "SUCCESS", derived_cipher_key

def main():
    now = int(time.time())

    # Scenario 1: Valid Key within expiration
    k1, exp1, _ = generate_key(duration_seconds=3600, device_id="IPHONE_15_PRO")
    ok1, msg1, c1 = verify_and_decrypt(k1, current_time=now, device_id="IPHONE_15_PRO")
    assert ok1 and c1 is not None, f"Scenario 1 Failed: {msg1}"
    print("[PASS 1/5] Valid Key correctly verified and cipher key derived!")

    # Scenario 2: Expired Key
    k2, exp2, _ = generate_key(duration_seconds=10, device_id="ANY")
    ok2, msg2, _ = verify_and_decrypt(k2, current_time=now + 20)
    assert not ok2 and "hết hạn" in msg2, f"Scenario 2 Failed: {msg2}"
    print("[PASS 2/5] Expired Key successfully blocked!")

    # Scenario 3: Tampered Key (Anti-Tamper HMAC)
    tampered_k = k1[:-2] + ("AA" if k1[-2:] != "AA" else "BB")
    ok3, msg3, _ = verify_and_decrypt(tampered_k, current_time=now)
    assert not ok3 and "không hợp lệ" in msg3, f"Scenario 3 Failed: {msg3}"
    print("[PASS 3/5] Tampered Key detected and blocked by HMAC-SHA256!")

    # Scenario 4: Clock Rollback Fraud
    ok4, msg4, _ = verify_and_decrypt(k1, current_time=now - 500, network_time=now)
    assert not ok4 and "vặn lùi" in msg4, f"Scenario 4 Failed: {msg4}"
    print("[PASS 4/5] Clock rollback detected and blocked!")

    # Scenario 5: HWID / Device Lock Mismatch
    k5, _, _ = generate_key(duration_seconds=3600, device_id="IPHONE_ADMIN_DEVICE")
    ok5, msg5, _ = verify_and_decrypt(k5, current_time=now, device_id="IPHONE_VICTIM_DEVICE")
    assert not ok5 and "khóa vào thiết bị khác" in msg5, f"Scenario 5 Failed: {msg5}"
    print("[PASS 5/5] HWID / Device Lock mismatch prevented unauthorized sharing!")

    print("\n[SUCCESS] ALL 5 ANTI-CHEAT SCENARIOS PASSED 100%!")

if __name__ == "__main__":
    main()
