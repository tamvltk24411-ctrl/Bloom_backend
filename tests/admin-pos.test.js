const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Service = require('../models/Service');
const Product = require('../models/Product');
const Deposit = require('../models/Deposit');
const Invoice = require('../models/Invoice');
const BusinessCounter = require('../models/BusinessCounter');
const adminPosController = require('../controllers/admin-pos.controller');

const customerId = '64b000000000000000000001';
const serviceId = '64b000000000000000000002';
const productId = '64b000000000000000000003';
const depositId = '64b000000000000000000004';

function createResponse() {
  const result = {};
  return {
    result,
    status(status) {
      result.status = status;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
}

function stubCheckoutDependencies(t, options = {}) {
  const customer = { _id: customerId, prepaidBalance: 1000 };
  const invoiceWrites = [];
  const productUpdates = [];
  const depositUpdates = [];
  const session = {
    withTransaction: callback => callback(),
    endSession: async () => {}
  };
  t.mock.method(mongoose, 'startSession', async () => session);
  t.mock.method(User, 'findOne', () => ({ session: async () => customer }));
  t.mock.method(User, 'findOneAndUpdate', async () => options.walletCustomer || customer);
  t.mock.method(Service, 'findOne', () => ({
    session: async () => ({ _id: serviceId, serviceName: 'Facial', price: 500 })
  }));
  t.mock.method(Product, 'findOne', () => ({
    session: async () => ({ _id: productId, productName: 'Serum', price: 300 })
  }));
  t.mock.method(Product, 'updateOne', async (...args) => {
    productUpdates.push(args);
    return { modifiedCount: options.stockFailure ? 0 : 1 };
  });
  t.mock.method(Deposit, 'findOne', () => ({
    session: async () => options.deposit || { _id: depositId, amount: 200 }
  }));
  t.mock.method(Deposit, 'updateOne', async (...args) => {
    depositUpdates.push(args);
    return { modifiedCount: 1 };
  });
  t.mock.method(Invoice, 'create', async (documents, options) => {
    invoiceWrites.push({ documents, options });
    return documents;
  });
  t.mock.method(Invoice, 'exists', async () => null);
  t.mock.method(BusinessCounter, 'findOneAndUpdate', async () => ({ sequence: 1 }));

  return { session, invoiceWrites, productUpdates, depositUpdates };
}

async function submitCheckout(body) {
  const response = createResponse();
  let forwardedError;
  await adminPosController.posCheckout({ body }, response, error => {
    forwardedError = error;
  });
  return { ...response.result, forwardedError };
}

test('checkout prices items from catalog and atomically computes totals, deposit and debt', async t => {
  const writes = stubCheckoutDependencies(t);
  const result = await submitCheckout({
    customerId,
    items: [
      { itemId: serviceId, type: 'service', quantity: 1, unitPrice: 1 },
      { itemId: productId, type: 'product', quantity: 2, unitPrice: 1 }
    ],
    discountAmount: 100,
    depositId,
    paidAmount: 300,
    paymentMethod: 'cash'
  });

  const invoice = writes.invoiceWrites[0].documents[0];
  assert.equal(result.status, 201);
  assert.equal(invoice.totalAmount, 1100);
  assert.equal(invoice.depositDeduction, 200);
  assert.equal(invoice.finalAmount, 800);
  assert.equal(invoice.paidAmount, 300);
  assert.equal(invoice.debtAmount, 500);
  assert.equal(invoice.debtStatus, 'partially_paid');
  assert.equal(invoice.status, 'partially_paid');
  assert.equal(invoice.items[0].unitPrice, 500);
  assert.equal(invoice.items[1].amount, 600);
  assert.equal(writes.productUpdates.length, 1);
  assert.equal(writes.depositUpdates.length, 1);
  assert.equal(writes.invoiceWrites[0].options.session, writes.session);
});

test('checkout does not persist invoice or stock changes when stock is insufficient', async t => {
  const writes = stubCheckoutDependencies(t, { stockFailure: true });
  const result = await submitCheckout({
    customerId,
    items: [{ itemId: productId, type: 'product', quantity: 2 }],
    paymentMethod: 'cash'
  });

  assert.equal(result.forwardedError.status, 400);
  assert.equal(writes.productUpdates.length, 1);
  assert.equal(writes.invoiceWrites.length, 0);
});
