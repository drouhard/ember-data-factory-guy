DS.Store.reopen({
  /**
    Make new fixture and save to store. If the store is using FixtureAdapter,
    will push to FIXTURE array, otherwise will use push method on adapter.

    @param name
    @param options
    @returns {*}
   */
  makeFixture: function (name, options) {
    var modelName = FixtureFactory.lookupModelForName(name);
    var fixture = FixtureFactory.build(name, options);
    var modelType = this.modelFor(modelName);

    var adapter = this.adapterFor('application');
    if (adapter.toString().match('Fixture')) {
      this.setBelongsToFixturesAssociation(modelType, modelName, fixture);
      return FixtureFactory.pushFixture(modelType, fixture);
    } else {
      var model = this.push(modelName, fixture);
      return model;
    }
  },

  /**
    Trying to set the belongsTo association for FixtureAdapter,
      with models that have a hasMany association.

    For example if a client hasMany projects, then set the client.id
    on each project that the client hasMany of, so that the project
    now has the belongsTo client association setup.

    @param name
    @param model
   */
  setBelongsToFixturesAssociation: function (modelType, modelName, parentFixture) {
    var store = this;
    var adapter = this.adapterFor('application');
    var relationShips = Ember.get(modelType, 'relationshipNames');

    if (relationShips.hasMany) {
      relationShips.hasMany.forEach(function (name) {
        var hasManyModel = store.modelFor(Em.String.singularize(name));
        var hasManyfixtures = adapter.fixturesForType(hasManyModel);
        if (hasManyfixtures) {
          hasManyfixtures.forEach(function(fixture) {
            fixture[modelName] = parentFixture.id
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
    var adapter = this.adapterFor('application');
    if (adapter.toString().match('Fixture')) {
      var model = this.modelFor(modelName);
      FixtureFactory.pushFixture(model, payload);
    } else {
      this._super(type, payload)
    }
  }
})