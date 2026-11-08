const test = require('node:test');
const assert = require('node:assert/strict');
const Article = require('../models/Article');
const Deposit = require('../models/Deposit');
const Invoice = require('../models/Invoice');
const Staff = require('../models/Staff');
const User = require('../models/User');
const Service = require('../models/Service');
const Product = require('../models/Product');
const BusinessCounter = require('../models/BusinessCounter');
const { dateParts, generateBusinessCode } = require('../utils/business-codes');

test('business schemas expose the agreed status, amount, and soft-delete fields', () => {
  assert.deepEqual(Article.schema.path('status').enumValues, ['draft', 'published', 'archived']);
  assert.deepEqual(Deposit.schema.path('depositStatus').enumValues, ['held', 'refunded', 'settled']);
  assert.deepEqual(Invoice.schema.path('status').enumValues, [
    'draft', 'issued', 'partially_paid', 'paid', 'voided'
  ]);
  assert.ok(Deposit.schema.path('amount'));
  assert.equal(User.schema.path('mustChangePassword').defaultValue, false);
  assert.ok(Staff.schema.path('status').enumValues.includes('inactive'));

  for (const Model of [User, Service, Product, Staff]) {
    assert.ok(Model.schema.path('deletedAt'), `${Model.modelName} should have deletedAt`);
  }
});

test('articles preserve legacy publication state and deposits map legacy amounts', async () => {
  const article = new Article({
    title: 'Legacy article',
    slug: 'legacy-article',
    category: 'cham-soc-da',
    authorStaffId: '64b000000000000000000002',
    summary: 'Summary',
    contentHtml: '<p>Content</p>',
    isPublished: true
  });
  await article.validate();
  assert.equal(article.status, 'published');

  const legacyArticle = Article.hydrate({
    _id: '64b000000000000000000003',
    title: 'Stored legacy article',
    slug: 'stored-legacy-article',
    category: 'cham-soc-da',
    authorStaffId: '64b000000000000000000002',
    summary: 'Summary',
    contentHtml: '<p>Content</p>',
    isPublished: true
  });
  assert.equal(legacyArticle.status, 'published');

  const deposit = new Deposit({
    depositCode: 'COC-test',
    customerId: '64b000000000000000000001',
    depositAmount: 250
  });
  await deposit.validate();
  assert.equal(deposit.amount, 250);
});

test('business code generation skips codes already present in legacy records', async t => {
  let sequence = 0;
  t.mock.method(BusinessCounter, 'findOneAndUpdate', async () => ({
    sequence: ++sequence
  }));
  const Model = {
    exists: async filter => filter.customerCode === 'KH-001' ? { _id: 'legacy' } : null
  };

  const code = await generateBusinessCode(
    Model,
    'customerCode',
    'customer',
    value => `KH-${String(value).padStart(3, '0')}`
  );
  assert.equal(code, 'KH-002');
  assert.deepEqual(dateParts(new Date('2026-11-08T23:59:59.000Z')), {
    year: '2026',
    month: '11',
    day: '08'
  });
});
