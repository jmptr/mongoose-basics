'use strict';

let expect = require('chai').expect;
let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let connStr = process.env.MONGO_URI;
let connOpts = {
  server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } },
  replset: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }
};

/*
 *  First let's look at the mongoose connection
 *  https://github.com/Automattic/mongoose#connecting-to-mongodb
 */
describe('mongoose connection', () => {
  it('createConnection should return a connection', done => {
    let connection = mongoose.createConnection(connStr, connOpts);

    // the mongoose connection extends Node's EventEmitter, so one can use
    // .once() to acquire a live connection once the db is connected
    connection.once('connected', () => {
      expect(connection._readyState).to.equal(1);
      connection.close();
      done();
    });

  });

  it('connect returns undefined, use mongoose.connection to get connection object', done => {
    mongoose.connect(connStr);

    mongoose.connection.once('connected', () => {
      expect(mongoose.connection._readyState).to.equal(1);
      mongoose.connection.close();
      done();
    });
  });
});

/*
 *  Now let's check out mongoose schemas
 *  https://github.com/Automattic/mongoose#defining-a-model
 */
describe('mongoose schemas', () => {
  let connection;
  let UserModel;
  let User = new Schema({
    name: { type: String },
    age:  { type: Number },
    active: { type: Boolean },
    date: { type: Date, default: Date.now }
  });
  let instance;

  it('schemas are dictionaries of types that make models exposing the mongoose API', () => {
    // now the user schema has produced a model that exposes
    // the mongoose API
    expect(UserModel.find).to.be.defined;
  });

  it('with the model, make an instance', () => {

    instance = new UserModel();

    expect(instance).to.be.defined;
    expect(instance.name).to.be.defined;
    expect(instance.age).to.be.defined;
    expect(instance.active).to.be.defined;
  });

  it('with the instance, try to save (blank)', done => {
    instance = new UserModel();

    expect(instance.save).to.be.defined;

    instance.save(err => {
      // it might seem odd that err should be null since the model is empty,
      // but none of the fields were invalid or required, so this is expected
      expect(err).to.be.null;
      done();
    });
  });

  it('inspect mongoose errors on save', done => {
    instance = new UserModel();

    instance.age = 'this is not a number';
    instance.save(err => {

      // mongoose will save this err object to instance.
      expect(err).to.not.be.null;
      expect(instance.errors).to.be.defined;
      expect(err.errors.length).to.equal(instance.errors.length);

      // since we know the error is on age, let's look at mongoose's error
      // default error message
      expect(err.errors.age.message).to.
        equal('Cast to Number failed for value "this is not a number" at path "age"');

      done();
    });
  });

  beforeEach(done => {
    connection = mongoose.createConnection(connStr, connOpts);

    connection.once('connected', () => {
      UserModel = connection.model('User', User);
      done();
    });
  });

  afterEach(done => {
    UserModel.remove({}, () => {
      connection && connection.close();
      done();
    });
  });

});

/*
 * Now that we've figured out how to create and save a model,
 * let's look at how mongoose performs validation
 * http://mongoosejs.com/docs/validation.html
 */
describe('mongoose validation', () => {
  let connection;
  let ApptModel;
  let Appointment = new Schema({
    label: { type: String },
    start:  { type: Date },
    end: { 
      type: Date, 
      // this is how one adds a custom validator to a mongoose model
      validate: {
        validator: function (val) {
          // in this case val is the value of end
          // `this` is the model itself
          return this.start < val;
        },
        message: '{VALUE} must be after the start date'
      }
    }
  });

  it('should have an error when end is before start', done => {
    var appointment = new ApptModel();
    appointment.start = new Date();
    appointment.end = new Date();
    appointment.end.setDate(appointment.start.getDate() - 1);

    appointment.save(err => {
      expect(err.errors.end.message).contains('must be after the start date');
      done();
    });
  });

  beforeEach(done => {
    connection = mongoose.createConnection(connStr, connOpts);

    connection.once('connected', () => {
      ApptModel = connection.model('Appointment', Appointment);
      done();
    });
  });

  afterEach(done => {
    ApptModel.remove({}, () => {
      connection && connection.close();
      done();
    });
  });

});
