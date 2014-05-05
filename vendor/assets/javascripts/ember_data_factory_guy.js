FactoryGuy = Ember.Object.reopenClass({
  fixtureStore: {},
  fixtureLookup: {},
  modelIds: {},

  /**
   ```javascript

     User = DS.Model.extend({
        name: DS.attr('string'),
     })

     FactoryGuy.define('user', {
        default: {
          name: "Fred"
        },

        bob: {
          name: "Bob"
        }
     });

    ```

     For the User model, you can define fixtures like 'bob' or just use 'user'
     and get default values.

     And to get those fixtures you would call them this way:

      FactoryGuy.build('user') or FactoryGuy.build('bob')

    @param model the model to define
    @param config your default and named fixtures
   */
  define: function (model, config) {
    var info = this.getModelInfo(model);
    for (key in config) {
      var value = config[key];
      info[key] = value;
      if (key != 'default') {
        this.fixtureLookup[key] = model;
      }
    }
    // setup id
    this.modelIds[model] = 0;
  },

  /**

    @param model
   */
  getModelInfo: function (model) {
    if (!this.fixtureStore[model]) {
      this.fixtureStore[model] = {};
    }
    return this.fixtureStore[model];
  },

  /**

    @param name fixture name
    @returns model associated with fixture name
   */
  lookupModelForName: function (name) {
    var model = this.fixtureLookup[name];
    if (!model) {
      if (this.fixtureStore[name]) {
        model = name;
      }
    }
    return model;
  },

  /**
    Generate next id for model
   */
  generateId: function (model) {
    var lastId = this.modelIds[model] || 0;
    this.modelIds[model] = lastId + 1;
    return this.modelIds[model];
  },

  /**
    Build fixtures for model or specific fixture name. For example:

      FactoryGuy.build('user') for User model
      FactoryGuy.build('bob') for User model with bob attributes

    @param name fixture name
    @param opts options that will override default fixture values
    @returns {*}
   */
  build: function (name, opts) {
    var model = this.lookupModelForName(name);
    if (!model) {
      throw new Error("can't find that factory named [" + name + "]");
    }

    var modelInfo = this.fixtureStore[model];
    var modelAttributes = modelInfo[name] || {};
    var defaultModelAttributes = modelInfo.default;
    var fixture = $.extend({}, defaultModelAttributes, modelAttributes, opts);
    if(!fixture.id){
      fixture.id = this.generateId(model);
    }
    return fixture;
  },

  /**
    Clear model instances from FIXTURES array, and from store cache.
    Reset the id sequence for the models back to zero.
   */
  resetModels: function (store) {
    var typeMaps = store.typeMaps;
    if (store.usingFixtureAdapter()) {
      for (typeKey in this.fixtureStore) {
        var modelType = store.modelFor(typeKey);
        modelType.FIXTURES = [];
        store.unloadAll(modelType);
      }
    } else {
      for (model in typeMaps) {
        store.unloadAll(typeMaps[model].type);
      }
    }
    this.modelIds = {}
  },

  /**
    Push fixture to model's FIXTURES array.
    Used when store's adapter is a DS.FixtureAdapter.

    @param modelClass DS.Model type
    @param fixture the fixture to add
   */
  pushFixture: function (modelClass, fixture) {
    if (!modelClass['FIXTURES']) {
      modelClass['FIXTURES'] = [];
    }
    modelClass['FIXTURES'].push(fixture);
    return fixture;
  }
})

DS.Store.reopen({

  usingFixtureAdapter: function() {
    var adapter = this.adapterFor('application');
    return adapter instanceof DS.FixtureAdapter
  },

  /**
    Make new fixture and save to store. If the store is using FixtureAdapter,
    will push to FIXTURE array, otherwise will use push method on adapter.

    @param name name of fixture
    @param options fixture options
    @returns {*}
   */
  makeFixture: function (name, options) {
    var modelName = FactoryGuy.lookupModelForName(name);
    var fixture = FactoryGuy.build(name, options);
    var modelType = this.modelFor(modelName);

    if (this.usingFixtureAdapter()) {
      this.setBelongsToFixturesAdapter(modelType, modelName, fixture);
      return FactoryGuy.pushFixture(modelType, fixture);
    } else {
      var self = this;
      var model;
      Em.run( function() {
        model = self.push(modelName, fixture);
        self.setBelongsToRESTAdapter(modelType, modelName, model);
      });
      return model;
    }
  },

  /**
    Set the belongsTo association for FixtureAdapter,
      with models that have a hasMany association.

    For example if a user hasMany projects, then set the user.id
    on each project that the user hasMany of, so that the project
    now has the belongsTo user association setup.

    @param modelType model type like App.User
    @param modelName model name like 'user'
    @param parentFixture parent to assign as belongTo
   */
  setBelongsToFixturesAdapter: function (modelType, modelName, parentFixture) {
    var store = this;
    var adapter = this.adapterFor('application');
    var relationShips = Ember.get(modelType, 'relationshipNames');
    if (relationShips.hasMany) {
      relationShips.hasMany.forEach(function (relationship) {
        var hasManyModel = store.modelFor(Em.String.singularize(relationship));
        if (parentFixture[relationship]) {
          parentFixture[relationship].forEach(function(id) {
            var hasManyfixtures = adapter.fixturesForType(hasManyModel);
            var fixture = adapter.findFixtureById(hasManyfixtures, id);
            fixture[modelName] = parentFixture.id;
          })
        }
      })
    }
  },

  /**
    Set the belongsTo association for the REST type models
      with a hasMany association

    For example if a user hasMany projects, then set the user
    on each project that the user hasMany of, so that the project
    now has the belongsTo user association setup

    @param modelType model type like 'App.User'
    @param modelName model name like 'user'
    @param parent model to check for hasMany
   */
  setBelongsToRESTAdapter: function (modelType, modelName, parent) {
    var relationShips = Ember.get(modelType, 'relationshipNames');

    if (relationShips.hasMany) {
      relationShips.hasMany.forEach(function (name) {
        var children = parent.get(name);
        if (children.get('length') > 0) {
          children.forEach(function(child) {
            child.set(modelName, parent)
          })
        }
      })
    }
  },

  /**
    Adding a pushPayload for FixtureAdapter, but using the original with
     other adapters that support pushPayload.

    @param type
    @param payload
   */
  pushPayload: function (type, payload) {
    if (this.usingFixtureAdapter()) {
      var model = this.modelFor(modelName);
      FactoryGuy.pushFixture(model, payload);
    } else {
      this._super(type, payload);
    }
  }
});


DS.FixtureAdapter.reopen({

  /**
    Overriding createRecord in FixtureAdapter to add the record
     created to the hashMany records for all of the records that
     this one belongsTo.

    @method createRecord
    @param {DS.Store} store
    @param {subclass of DS.Model} type
    @param {DS.Model} record
    @return {Promise} promise
  */
  createRecord: function(store, type, record) {
    var promise = this._super(store, type, record);

//    promise.then( function() {
//      var hasManyName = Ember.String.pluralize(type.typeKey);
//      var relationShips = Ember.get(type, 'relationshipNames');
//      if (relationShips.belongsTo) {
//        console.log('record',record+'', type.typeKey, hasManyName);
//        relationShips.belongsTo.forEach(function (relationship) {
//          console.log(relationship, record.get(relationship)+'')
//          var belongsToRecord = record.get(relationship);
//          console.log(relationshipForType)
//          belongsToRecord.get(hasManyName).addObject(record);
//        })
//      }
//    })
    return promise;
  }

})


FactoryGuyHelperMixin = Em.Mixin.create({

  // Pass in the app root, which typically is App.
  setup: function(app) {
    this.set('container', app.__container__);
    return this;
  },

  useFixtureAdapter: function(app) {
    app.ApplicationAdapter = DS.FixtureAdapter;
    this.getStore().adapterFor('application').simulateRemoteResponse = false;
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
    var model = FactoryGuy.lookupModelForName(name);
    this.stubEndpointForHttpRequest(
      "/" + Em.String.pluralize(model),
      this.buildAjaxResponse(name, opts),
      {type: 'POST'}
    )
  },

  buildAjaxResponse: function (name, opts) {
    var fixture = FactoryGuy.build(name, opts);
    var model = FactoryGuy.lookupModelForName(name);
    var hash = {};
    hash[model] = fixture;
    return hash;
  },

  handleUpdate: function (root, id) {
    this.stubEndpointForHttpRequest(
      "/" + Em.String.pluralize(root) + "/" + id, {}, {type: 'PUT'}
    )
  },

  handleDelete: function (root, id) {
    this.stubEndpointForHttpRequest(
      "/" + Em.String.pluralize(root) + "/" + id, {}, {type: 'DELETE'}
    )
  },

  teardown: function () {
    FactoryGuy.resetModels(this.getStore());
  }

})