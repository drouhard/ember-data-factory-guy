import Ember from 'ember';
import MockRequest from './mock-request';
import FactoryGuy from "../factory-guy";
import Model from 'ember-data/model';

export default class MockLinksRequest extends MockRequest {

  constructor(model, relationshipKey) {
    super();
    this.model = model;
    this.relationshipKey = relationshipKey;
    this.relationship = this.getRelationship();
    this.fixtureBuilder = FactoryGuy.fixtureBuilder(this.relationship.type);
    this.setValidReturnsKeys();
    this.type = 'GET';
    this.status = 200;
    this.setupHandler();
  }

  getRelationship() {
    let modelClass    = this.model.constructor,
        relationships = Ember.get(modelClass, 'relationshipsByName'),
        relationship  = relationships.get(this.relationshipKey);

    Ember.assert(
      `[ember-data-factory-guy] mockLinks can not find that relationship 
        [${this.relationshipKey}] on model of type ${modelClass.modelName}`,
      relationship
    );

    return relationship;
  }

  setValidReturnsKeys() {
    let isBelongsTo = this.relationship.kind === 'belongsTo';
    let validKeys = isBelongsTo ? ['model', 'json'] : ['models', 'json'];
    this.validReturnsKeys = validKeys;
  }

  getUrl() {
    return this.model[this.relationship.kind](this.relationshipKey).link();
  }

  getType() {
    return this.type;
  }

  validateReturnsOptions(options) {
    const responseKeys = Object.keys(options);

    Ember.assert(`[ember-data-factory-guy] You can pass one key to 'returns',
                you passed these keys: ${responseKeys}`, responseKeys.length === 1);

    const [responseKey] = responseKeys;

    Ember.assert(`[ember-data-factory-guy] You passed an invalid keys for 'returns' function.
      Valid keys are ${this.validReturnsKeys}. You used this invalid key: ${responseKey}`,
      this.validReturnsKeys.includes(responseKey));

    return responseKey;
  }

  returns(options = {}) {
    let responseKey = this.validateReturnsOptions(options);
    this.setReturns(responseKey, options);
    return this;
  }

  setReturns(responseKey, options) {
    let json, model, models, modelName = this.relationship.type;

    switch (responseKey) {
      case 'id': {
        // if you want to return existing model with an id, set up the json
        // as if it might be found, but check later during request match to
        // see if it really exists
        json = {id: options.id};
        this.idSearch = true;
        this.setResponseJson(this.fixtureBuilder.convertForBuild(modelName, json));
        break;
      }

      case 'model':
        model = options.model;

        Ember.assert(`[ember-data-factory-guy] argument ( model ) must be a Model instance - found type:'
          ${Ember.typeOf(model)}`, (model instanceof Model));

        json = {id: model.id};
        this.setResponseJson(this.fixtureBuilder.convertForBuild(modelName, json));
        break;

      case 'ids': {
        const store = FactoryGuy.store;
        models = options.ids.map((id) => store.peekRecord(modelName, id));
        this.returns({models});
        break;
      }

      case 'models': {
        models = options.models;

        Ember.assert(`[ember-data-factory-guy] argument ( models ) must be an array - found type:'
          ${Ember.typeOf(models)}`, Ember.isArray(models));

        json = models.map(model => ({id: model.id}));
        json = this.fixtureBuilder.convertForBuild(modelName, json);
        this.setResponseJson(json);
        break;
      }

      case 'json':
        json = options.json;
        if (!json.isProxy) {
          // need to wrap a payload in proxy class if not already done so
          this.fixtureBuilder.wrapPayload(modelName, json);
        }
        this.setResponseJson(json);
        break;

      case 'headers':
        this.addResponseHeaders(options.headers);
        break;
    }
  }

  setResponseJson(json) {
    this.responseJson = json;
    this.setupHandler();
  }

}
