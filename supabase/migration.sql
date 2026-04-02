-- =============================================================================
-- Inventory Reservation System — Full Database Schema
--
-- Run this file in the Supabase SQL Editor to create all tables, constraints,
-- indexes, triggers, and PostgreSQL functions needed by the API.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- -----------------------------------------------------------------------------
-- 2. Items table
--    Tracks inventory items with total, reserved, and confirmed quantities.
--    The CHECK constraint ensures over-allocation is never possible.
-- -----------------------------------------------------------------------------

CREATE TABLE items (
    id                  UUID        NOT NULL DEFAULT uuid_generate_v4(),
    name                TEXT        NOT NULL,
    total_quantity      INTEGER     NOT NULL CHECK (total_quantity > 0),
    reserved_quantity   INTEGER     NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    confirmed_quantity  INTEGER     NOT NULL DEFAULT 0 CHECK (confirmed_quantity >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT items_pkey PRIMARY KEY (id),

    -- Prevent over-allocation: held + confirmed stock must not exceed total
    CONSTRAINT items_quantity_check
        CHECK (reserved_quantity + confirmed_quantity <= total_quantity)
);


-- -----------------------------------------------------------------------------
-- 3. Reservations table
--    Each row represents a single customer reservation against an item.
--    Status lifecycle: PENDING → CONFIRMED | CANCELLED | EXPIRED
-- -----------------------------------------------------------------------------

CREATE TABLE reservations (
    id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
    item_id     UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    customer_id TEXT        NOT NULL,
    quantity    INTEGER     NOT NULL CHECK (quantity > 0),
    status      TEXT        NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reservations_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------

-- Supports: WHERE item_id = ? AND status = ?
CREATE INDEX idx_reservations_item_status
    ON reservations(item_id, status);

-- Supports: WHERE status = 'PENDING' AND expires_at <= NOW()
CREATE INDEX idx_reservations_status_expires
    ON reservations(status, expires_at);


-- -----------------------------------------------------------------------------
-- 5. updated_at trigger
--    Automatically sets updated_at = NOW() on every UPDATE.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 6. Atomic inventory operations (PostgreSQL functions)
--
--    Each function runs inside a single transaction and uses
--    SELECT ... FOR UPDATE for row-level locking to prevent overselling.
--    Called from the API via supabase.rpc().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 6a. reserve_inventory
--     Locks the item row, checks availability, deducts from available stock,
--     and creates a PENDING reservation with a 10-minute TTL.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reserve_inventory(
    p_item_id UUID,
    p_customer_id TEXT,
    p_quantity INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_item items%ROWTYPE;
    v_available INTEGER;
    v_reservation reservations%ROWTYPE;
BEGIN
    SELECT * INTO v_item
    FROM items
    WHERE id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND: Item % does not exist', p_item_id;
    END IF;

    v_available := v_item.total_quantity - v_item.reserved_quantity - v_item.confirmed_quantity;

    IF p_quantity > v_available THEN
        RAISE EXCEPTION 'INSUFFICIENT_INVENTORY: Requested % but only % available', p_quantity, v_available;
    END IF;

    UPDATE items
    SET reserved_quantity = reserved_quantity + p_quantity
    WHERE id = p_item_id;

    INSERT INTO reservations (item_id, customer_id, quantity, status, expires_at)
    VALUES (p_item_id, p_customer_id, p_quantity, 'PENDING', NOW() + INTERVAL '10 minutes')
    RETURNING * INTO v_reservation;

    RETURN json_build_object(
        'reservation_id', v_reservation.id,
        'item_id', v_reservation.item_id,
        'customer_id', v_reservation.customer_id,
        'quantity', v_reservation.quantity,
        'status', v_reservation.status,
        'created_at', v_reservation.created_at,
        'expires_at', v_reservation.expires_at,
        'updated_at', v_reservation.updated_at
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 6b. confirm_reservation
--     Moves PENDING → CONFIRMED, transferring quantity from reserved to
--     confirmed. Idempotent: re-confirming returns success without side effects.
--     Also checks expires_at: if a PENDING reservation is past its TTL,
--     it is auto-expired instead of confirmed.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION confirm_reservation(
    p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservation reservations%ROWTYPE;
BEGIN
    SELECT * INTO v_reservation
    FROM reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Reservation % does not exist', p_reservation_id;
    END IF;

    -- Idempotent: already confirmed
    IF v_reservation.status = 'CONFIRMED' THEN
        RETURN json_build_object(
            'reservation_id', v_reservation.id,
            'status', v_reservation.status,
            'quantity', v_reservation.quantity,
            'item_id', v_reservation.item_id,
            'updated_at', v_reservation.updated_at
        );
    END IF;

    IF v_reservation.status = 'EXPIRED' THEN
        RAISE EXCEPTION 'EXPIRED: Reservation has expired';
    END IF;

    IF v_reservation.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'CANCELLED: Reservation was cancelled';
    END IF;

    -- PENDING but past TTL: auto-expire instead of confirming
    IF v_reservation.expires_at < NOW() THEN
        UPDATE items
        SET reserved_quantity = reserved_quantity - v_reservation.quantity
        WHERE id = v_reservation.item_id;

        UPDATE reservations
        SET status = 'EXPIRED'
        WHERE id = p_reservation_id;

        RAISE EXCEPTION 'EXPIRED: Reservation has expired';
    END IF;

    -- Transfer reserved → confirmed
    UPDATE items
    SET reserved_quantity = reserved_quantity - v_reservation.quantity,
        confirmed_quantity = confirmed_quantity + v_reservation.quantity
    WHERE id = v_reservation.item_id;

    UPDATE reservations
    SET status = 'CONFIRMED'
    WHERE id = p_reservation_id
    RETURNING * INTO v_reservation;

    RETURN json_build_object(
        'reservation_id', v_reservation.id,
        'status', v_reservation.status,
        'quantity', v_reservation.quantity,
        'item_id', v_reservation.item_id,
        'updated_at', v_reservation.updated_at
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 6c. cancel_reservation
--     Moves PENDING → CANCELLED, releasing held quantity. Idempotent for
--     CANCELLED and EXPIRED states. Rejects cancel after confirmation.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cancel_reservation(
    p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservation reservations%ROWTYPE;
BEGIN
    SELECT * INTO v_reservation
    FROM reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Reservation % does not exist', p_reservation_id;
    END IF;

    IF v_reservation.status IN ('CANCELLED', 'EXPIRED') THEN
        RETURN json_build_object(
            'reservation_id', v_reservation.id,
            'status', v_reservation.status,
            'quantity', v_reservation.quantity,
            'item_id', v_reservation.item_id,
            'updated_at', v_reservation.updated_at
        );
    END IF;

    IF v_reservation.status = 'CONFIRMED' THEN
        RAISE EXCEPTION 'CONFIRMED: Reservation was already confirmed';
    END IF;

    UPDATE items
    SET reserved_quantity = reserved_quantity - v_reservation.quantity
    WHERE id = v_reservation.item_id;

    UPDATE reservations
    SET status = 'CANCELLED'
    WHERE id = p_reservation_id
    RETURNING * INTO v_reservation;

    RETURN json_build_object(
        'reservation_id', v_reservation.id,
        'status', v_reservation.status,
        'quantity', v_reservation.quantity,
        'item_id', v_reservation.item_id,
        'updated_at', v_reservation.updated_at
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 6d. expire_stale_reservations
--     Finds all PENDING reservations past their expires_at, marks them EXPIRED,
--     and releases held quantities back to available inventory.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_expired_count INTEGER := 0;
    v_reservation RECORD;
BEGIN
    FOR v_reservation IN
        SELECT r.id, r.item_id, r.quantity
        FROM reservations r
        WHERE r.status = 'PENDING'
          AND r.expires_at < NOW()
        FOR UPDATE OF r
    LOOP
        UPDATE items
        SET reserved_quantity = reserved_quantity - v_reservation.quantity
        WHERE id = v_reservation.item_id;

        UPDATE reservations
        SET status = 'EXPIRED'
        WHERE id = v_reservation.id;

        v_expired_count := v_expired_count + 1;
    END LOOP;

    RETURN json_build_object('expired_count', v_expired_count);
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. RLS policies and permissions
--    Enable RLS on both tables and grant the anon role full access.
--    This allows the API to use the anon/public key instead of the
--    service role key — no need to expose a key that bypasses RLS.
-- -----------------------------------------------------------------------------

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Allow all operations via the anon role (no auth in this API)
CREATE POLICY "Allow all access to items" ON items
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to reservations" ON reservations
    FOR ALL USING (true) WITH CHECK (true);

-- Grant execute on RPC functions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_reservation(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_reservation(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_reservations() TO anon, authenticated;
