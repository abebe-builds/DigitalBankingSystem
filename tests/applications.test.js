import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

const APP_PASS = 'AppTest123!';
const EMAILS = {
  customerA: 'app-test-custA@test.local',
  customerB: 'app-test-custB@test.local',
  employee:  'app-test-emp@test.local',
  managerR:  'app-test-mgr-reviewer@test.local',  // will be the reviewer (no self-approval)
  managerA:  'app-test-mgr-approver@test.local',  // will be the approver (different from reviewer)
};
const userIds = {};
let applicationId;
let accountId;

const VALID_APP_BODY = {
  first_name: 'Tigist',
  last_name: 'Bekele',
  date_of_birth: '1990-05-15',
  national_id: 'ETH123456',
  phone: '+251911234567',
  email: 'tigist.bekele@example.com',
  address_line1: '123 Bole Road',
  city: 'Addis Ababa',
  account_type: 'SAVINGS',
};

before(async () => {
  const hash = await bcrypt.hash(APP_PASS, 10);
  const roleMap = {
    customerA: 'Customer',
    customerB: 'Customer',
    employee:  'Account Opening Employee',
    managerR:  'Manager/Authorized Approver',
    managerA:  'Manager/Authorized Approver',
  };
  for (const [key, roleName] of Object.entries(roleMap)) {
    const [[role]] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    assert.ok(role, `Role '${roleName}' must exist in DB`);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
      [EMAILS[key], hash, role.id, 'active'],
    );
    userIds[key] = result.insertId;
  }
});

after(async () => {
  const allUserIds = Object.values(userIds).filter(Boolean);
  if (allUserIds.length > 0) {
    const [appRows] = await pool.query(
      'SELECT id FROM account_applications WHERE customer_user_id IN (?)',
      [allUserIds],
    );
    const appIds = appRows.map((r) => r.id);
    if (appIds.length > 0) {
      await pool.query('DELETE FROM bank_accounts WHERE application_id IN (?)', [appIds]);
      await pool.query('DELETE FROM application_documents WHERE application_id IN (?)', [appIds]);
      await pool.query('DELETE FROM otp_tokens WHERE application_id IN (?)', [appIds]);
    }
    await pool.query('DELETE FROM otp_tokens WHERE user_id IN (?)', [allUserIds]);
    await pool.query('DELETE FROM account_applications WHERE customer_user_id IN (?)', [allUserIds]);
    await pool.query('DELETE FROM users WHERE id IN (?)', [allUserIds]);
  }
});

async function loginAs(key) {
  const agent = supertest.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: EMAILS[key], password: APP_PASS });
  assert.equal(res.status, 200, `Login failed for ${key}: ${JSON.stringify(res.body)}`);
  return agent;
}

describe('Create application', () => {
  it('customer creates draft: 201, status=DRAFT, reference_number format valid', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.post('/api/applications').send(VALID_APP_BODY);
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.application.status, 'DRAFT');
    assert.match(res.body.application.reference_number, /^APP-\d{8}-[A-Z0-9]{5}$/);
    applicationId = res.body.application.id;
  });

  it('reference_number matches APP-YYYYMMDD-XXXXX format in DB', async () => {
    const [rows] = await pool.query(
      'SELECT reference_number FROM account_applications WHERE id = ?',
      [applicationId],
    );
    assert.ok(rows.length > 0, 'application must exist in DB');
    assert.match(rows[0].reference_number, /^APP-\d{8}-[A-Z0-9]{5}$/);
  });

  it('customerB creates application for themselves (isolation: own ID used)', async () => {
    const agent = await loginAs('customerB');
    const res = await agent.post('/api/applications').send(VALID_APP_BODY);
    assert.equal(res.status, 201);
    assert.equal(res.body.application.customer_user_id, userIds.customerB);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await supertest(app).post('/api/applications').send(VALID_APP_BODY);
    assert.equal(res.status, 401);
  });
});

describe('Submit application', () => {
  it('customer A submits: DRAFT -> SUBMITTED (200)', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.post(`/api/applications/${applicationId}/submit`);
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'SUBMITTED');
  });

  it('cannot submit same application again (already SUBMITTED): 409', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.post(`/api/applications/${applicationId}/submit`);
    assert.equal(res.status, 409);
  });
});

describe('Employee review', () => {
  it('managerR reviews: SUBMITTED -> UNDER_REVIEW (200)', async () => {
    // managerR is used as reviewer so we can test no-self-approval later
    const agent = await loginAs('managerR');
    const res = await agent.post(`/api/applications/${applicationId}/review`).send({ notes: 'Looks good' });
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'UNDER_REVIEW');
  });

  it('customer cannot review (403 — lacks applications.review permission)', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.post(`/api/applications/${applicationId}/review`);
    assert.equal(res.status, 403);
  });
});

describe('Correction cycle', () => {
  it('employee requests correction: UNDER_REVIEW -> CORRECTION_REQUIRED (200)', async () => {
    const agent = await loginAs('employee');
    const res = await agent.post(`/api/applications/${applicationId}/request-correction`).send({
      correction_instructions: 'Please provide a clearer copy of national ID',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'CORRECTION_REQUIRED');
  });

  it('customer updates application in CORRECTION_REQUIRED (200)', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.put(`/api/applications/${applicationId}`).send({
      national_id: 'ETH999999',
    });
    assert.equal(res.status, 200);
  });

  it('customer re-submits: CORRECTION_REQUIRED -> SUBMITTED (200)', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.post(`/api/applications/${applicationId}/submit`);
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'SUBMITTED');
  });
});

describe('Approval flow', () => {
  before(async () => {
    // Move back to UNDER_REVIEW using managerR (who will be the recorded reviewer)
    const agent = await loginAs('managerR');
    const res = await agent.post(`/api/applications/${applicationId}/review`).send({ notes: 'Re-reviewing' });
    assert.equal(res.status, 200, 'Setup: move to UNDER_REVIEW failed');
  });

  it('self-approval rejected (managerR reviewed, managerR tries to approve): 409', async () => {
    const agent = await loginAs('managerR');
    const res = await agent.post(`/api/applications/${applicationId}/approve`).send({ notes: 'Self-approve' });
    assert.equal(res.status, 409);
  });

  it('managerA approves (different from reviewer managerR): UNDER_REVIEW -> APPROVED (200)', async () => {
    const agent = await loginAs('managerA');
    const res = await agent.post(`/api/applications/${applicationId}/approve`).send({
      notes: 'All documents verified',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'APPROVED');
  });
});

describe('Rejection flow', () => {
  it('manager rejects a submitted application -> REJECTED (200)', async () => {
    // Create a fresh application for rejection test
    const agentC = await loginAs('customerA');
    const createRes = await agentC.post('/api/applications').send(VALID_APP_BODY);
    assert.equal(createRes.status, 201);
    const rejAppId = createRes.body.application.id;

    // Submit it
    const submitRes = await agentC.post(`/api/applications/${rejAppId}/submit`);
    assert.equal(submitRes.status, 200);

    // Manager rejects it directly from SUBMITTED state
    const agentM = await loginAs('managerA');
    const res = await agentM.post(`/api/applications/${rejAppId}/reject`).send({
      rejection_reason: 'Insufficient documentation',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'REJECTED');
  });
});

describe('Account creation', () => {
  it('manager creates account from APPROVED: 201, status=ACCOUNT_CREATED, account_number format valid', async () => {
    const agent = await loginAs('managerA');
    const res = await agent.post(`/api/applications/${applicationId}/create-account`);
    assert.equal(res.status, 201);
    assert.equal(res.body.application.status, 'ACCOUNT_CREATED');
    assert.ok(res.body.account, 'account object should be present');
    assert.match(res.body.account.account_number, /^ETB-\d{8}-[A-Z0-9]{8}$/);
    accountId = res.body.account.id;
  });

  it('account ID is a positive integer', () => {
    assert.ok(typeof accountId === 'number' && accountId > 0, 'accountId should be a positive integer');
  });

  it('idempotent: calling create-account again returns same account, no duplicate row', async () => {
    const agent = await loginAs('managerA');
    const res = await agent.post(`/api/applications/${applicationId}/create-account`);
    assert.equal(res.status, 201);
    assert.equal(res.body.account.id, accountId, 'same account ID should be returned on repeat call');
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS c FROM bank_accounts WHERE application_id = ?',
      [applicationId],
    );
    assert.equal(Number(rows[0].c), 1, 'only one bank_account row should exist for this application');
  });
});

describe('Cross-customer isolation', () => {
  it('customerB cannot see customerA application (404)', async () => {
    const agent = await loginAs('customerB');
    const res = await agent.get(`/api/applications/${applicationId}`);
    assert.equal(res.status, 404);
  });
});

describe('Invalid state transitions', () => {
  it('cannot submit an ACCOUNT_CREATED application (409)', async () => {
    const agent = await loginAs('customerA');
    const res = await agent.post(`/api/applications/${applicationId}/submit`);
    assert.equal(res.status, 409);
  });

  it('cannot approve a non-UNDER_REVIEW application (409)', async () => {
    const agent = await loginAs('managerA');
    const res = await agent.post(`/api/applications/${applicationId}/approve`).send({ notes: 'Try again' });
    assert.equal(res.status, 409);
  });
});
