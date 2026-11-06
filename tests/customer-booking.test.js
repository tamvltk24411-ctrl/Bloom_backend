const test = require('node:test');
const assert = require('node:assert/strict');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Schedule = require('../models/Schedule');
const customerController = require('../controllers/customer.controller');

const serviceId = '64b000000000000000000001';
const staffId = '64b000000000000000000002';
const validBody = {
  serviceId,
  staffId,
  appointmentDate: '2099-01-01',
  appointmentTime: '10:00'
};

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

function stubBookingDependencies(t, options = {}) {
  const { bookings = [] } = options;
  const schedule = Object.hasOwn(options, 'schedule')
    ? options.schedule
    : { isOff: false, maxCapacity: 5 };
  t.mock.method(User, 'findById', async () => ({
    fullName: 'Test Customer',
    username: 'test-customer',
    phone: ''
  }));
  t.mock.method(Service, 'findOne', async () => ({ durationMinutes: 60 }));
  t.mock.method(Staff, 'findById', async () => ({ status: 'working' }));
  t.mock.method(Schedule, 'findOne', async () => schedule);
  t.mock.method(Booking, 'find', () => ({
    populate: async () => bookings
  }));
  t.mock.method(Booking, 'countDocuments', async () => 0);
  t.mock.method(Booking, 'create', async booking => booking);
}

async function submitBooking(body) {
  const response = createResponse();
  await customerController.createBooking({
    body,
    session: { user: { _id: staffId } }
  }, response, error => {
    throw error;
  });
  return response.result;
}

test('rejects malformed IDs before database lookup', async t => {
  t.mock.method(Service, 'findOne', async () => {
    assert.fail('database lookup should not run');
  });
  const result = await submitBooking({ ...validBody, serviceId: 'invalid' });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.equal(result.body.data, null);
});

test('rejects a booking when the selected shift has no schedule', async t => {
  stubBookingDependencies(t, { schedule: null });
  const result = await submitBooking(validBody);

  assert.equal(result.status, 400);
  assert.match(result.body.message, /chưa được xếp lịch/);
});

test('rejects bookings when capacity is reached', async t => {
  stubBookingDependencies(t, {
    schedule: { isOff: false, maxCapacity: 1 },
    bookings: [{ appointmentTime: '09:00', serviceId: { durationMinutes: 60 } }]
  });
  const result = await submitBooking(validBody);

  assert.equal(result.status, 400);
  assert.match(result.body.message, /capacity|tối đa/i);
});

test('rejects overlapping appointments', async t => {
  stubBookingDependencies(t, {
    bookings: [{ appointmentTime: '09:30', serviceId: { durationMinutes: 60 } }]
  });
  const overlapping = await submitBooking(validBody);
  assert.equal(overlapping.status, 400);
  assert.match(overlapping.body.message, /đã có lịch hẹn/);
});

test('creates a booking when the selected time is available', async t => {
  stubBookingDependencies(t);
  const available = await submitBooking(validBody);
  assert.equal(available.status, 201);
  assert.equal(available.body.success, true);
  assert.equal(available.body.data.status, 'pending');
});
