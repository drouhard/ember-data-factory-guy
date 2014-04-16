FixtureFactoryHelperMixin = Em.Mixin.create({

  store: function(){
    this.get('container').lookup('store:main');
  }.property('container'),

  setup: function(app) {
    this.set('container', app.__container__);
    return this;
  },

  useFixtureAdapter: function(app) {
    app.ApplicationAdapter = DS.FixtureAdapter;
    this.get('store').adapterFor('application').simulateRemoteResponse = false;
  },

  find: function(type, id) {
    return this.getStore().find(type, id);
  },

  make: function(name, opts) {
    return this.getStore().makeFixture(name, opts);
  },

  getStore: function () {
    return this.get('container').lookup('store:main');
  },

  pushPayload: function(type, hash) {
    return this.getStore().pushPayload(type, hash);
  },

  pushRecord: function(type, hash) {
    return this.getStore().push(type, hash);
  },

  stubEndpointForHttpRequest: function (url, json, options) {
    options = options || {};
    var request = {
      url: url,
      dataType: 'json',
      responseText: json,
      type: options.type || 'GET',
      status: options.status || 200
    }

    if (options.data) {
      request.data = options.data
    }

    $.mockjax(request);
  },

  /**
   * Handling ajax POST for a model
   *
   * @param name of the fixture ( or model ) to create
   * @param opts fixture options
   */
  handleCreate: function (name, opts) {
    var model = FixtureFactory.lookupModelForName(name);
    this.stubEndpointForHttpRequest(
      "/" + Em.String.pluralize(model),
      this.buildAjaxResponse(name, opts),
      {type: 'POST'}
    )
  },

  buildAjaxResponse: function (name, opts) {
    var fixture = FixtureFactory.build(name, opts);
    var model = FixtureFactory.lookupModelForName(name);
    var hash = {};
    hash[model] = fixture;
    return hash;
  },

  handleUpdate: function (model) {
    var root = Em.String.pluralize(model.rootForType());
    this.stubEndpointForHttpRequest(
      "/" + root + "/" + model.get('id'), {}, {type: 'PUT'}
    )
  },

  handleDelete: function (root, id) {
    this.stubEndpointForHttpRequest(
      "/" + Em.String.pluralize(root) + "/" + id, {}, {type: 'DELETE'}
    )
  },

  teardown: function () {
    FixtureFactory.resetModels(this.getStore());
  }

})