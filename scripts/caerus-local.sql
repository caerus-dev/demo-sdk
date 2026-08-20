BEGIN;

INSERT INTO api_keys (id, environment_id, key_hash, key_prefix, state)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '8c7c20bad5a96ff66015ab8f0586e240c1ba640f020aa5253e41605f05e15230',
    'caer_dev_T3ST',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO shared_resource_templates (
    id, name, default_ttl_sec, save_metadata, environment_id,
    retry_inteval_sec, max_retry_count, use_idempotency,
    conflict_resolution, type, is_active
)
VALUES
    (
        'aaaaaaaa-0000-0000-0000-000000000001',
        'butaca',
        120, true, '11111111-1111-1111-1111-111111111111',
        1, 3, false, 'FAIL', 'UNITARY', true
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000002',
        'butaca_fila',
        120, true, '11111111-1111-1111-1111-111111111111',
        1, 3, false, 'QUEUE', 'UNITARY', true
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000003',
        'funcion_capacidad',
        120, true, '11111111-1111-1111-1111-111111111111',
        1, 3, false, 'FAIL', 'MULTIPLE', true
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000004',
        'producto',
        120, true, '11111111-1111-1111-1111-111111111111',
        1, 3, false, 'FAIL', 'MULTIPLE', true
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT name, type, conflict_resolution, default_ttl_sec, save_metadata, use_idempotency
FROM shared_resource_templates
WHERE environment_id = '11111111-1111-1111-1111-111111111111'
ORDER BY name;
