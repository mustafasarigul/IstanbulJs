(function () {
    window.ist = { defaults: { attributePrefix: 'data-bind-', changeEvent: 'keyup', elementAttributeName: 'ist_Id' } };
    var templates = [], uniqueId = 0;

    ist.templateManager = {
        register: function (element) {
            var id = ++uniqueId;
            var content = element.html();
            element.children().remove();
            var template = { id: 't_' + id, content: content, html: element[0].outerHTML };
            templates.push(template);
            return template.id;
        },
        get: function (id) {
            return templates.filter(function (template) {
                return template.id == id;
            })[0];
        }
    };

    function getContext(scope, values) {
        var methodBody = "return " + values;
        var value = new Function("$root", "$data", methodBody)(scope.$root, scope.$data);
        return value;
    };

    function findBindings(currentNode, scope, dispose) {
        var values;
        if (currentNode.attributes && currentNode.attributes.length > 0) {
            for (var i = 0; i < currentNode.attributes.length; i++) {
                if (currentNode.attributes[i].localName.indexOf(ist.defaults.attributePrefix) == -1) continue;
                if (currentNode.attributes[i].localName == ist.defaults.attributePrefix + 'using') {
                    values = getContext(scope, currentNode.attributes[i].nodeValue);
                    ist.handlerManager.get('using').manager.init($(currentNode), scope, values, ist.templateManager.register($(currentNode)));
                    currentNode = currentNode.nextSibling;
                    break;
                }
                if (currentNode.attributes[i].localName == ist.defaults.attributePrefix + 'each') {
                    values = getContext(scope, currentNode.attributes[i].nodeValue);
                    ist.handlerManager.get('each').manager.init($(currentNode), scope, values, ist.templateManager.register($(currentNode)));
                    currentNode = currentNode.nextSibling;
                    break;
                }
                else {
                    var handler = ist.handlerManager.get(currentNode.attributes[i].localName.replace(ist.defaults.attributePrefix, ''));
                    if (dispose)
                        ist.handlerManager.dispose($(currentNode), scope, handler, currentNode.attributes[i].nodeValue);
                    else
                        ist.handlerManager.init($(currentNode), scope, handler, currentNode.attributes[i].nodeValue);
                }
            }
        }
        currentNode = currentNode.firstChild;
        while (currentNode) {
            findBindings(currentNode, scope);
            currentNode = currentNode.nextSibling;
        }
    }

    function createElementForEach(element, data, scope, templateId) {
        var childElement;
        if (data == null) return;
        for (var d = 0; d < data.length; d++) {
            childElement = $(ist.templateManager.get(templateId).content);
            if (childElement == null) continue;

            var dispose = data[d].status == 1;
            findBindings(childElement[0], { $root: scope.$root, $data: data[d] }, dispose);

            if (dispose)
                childElement.remove();
            else
                element.append(childElement);
        }
    };

    function createElementForUsing(rootElement, childElement, scope, dispose) {
        childElement.remove();
        for (var i = 0; i < childElement.length; i++) {
            findBindings(childElement[i], scope, dispose);
        }
        if (!dispose)
            rootElement.append(childElement);
    };

    function createComboItems(element, items, textPropertyName) {
        for (var i = 0; i < items.length; i++) {
            var text = ist.utils.unwrapWatchable(items[i][textPropertyName]);
            element.append(new Option(text, i));
        }
    };

    function clone(obj) {
        if (obj  == null || typeof obj != "object") return obj;
        var copy = {};
        for (var attr in obj) {
            var value = obj[attr];
            switch (typeof value) {
                case "boolean":
                case "number":
                case "string":
                    copy[attr] = value;
                    break;
                case "function":
                    if (value.$t == 0) {
                        value = ist.utils.unwrapWatchable(obj[attr]);
                        copy[attr] = clone(value);
                    }
                    else if (value.$t == 1) {
                        value = ist.utils.unwrapWatchable(obj[attr]);
                        copy[attr] = [];
                        for (var i = 0; i < value.length; i++) {
                            copy[attr].push(clone(value[i]));
                        }
                    }
                    break;
                case "object":
                    if (value instanceof Array) {
                        copy[attr] = [];
                        for (var j = 0; j < value.length; j++) {
                            copy[attr].push(clone(value[j]));
                        }
                    }
                    else
                        copy[attr] = value;
                    break;
                case "undefined":
                    copy[attr] = null;
                    break;
            }
        }
        return copy;
    };

    ist.bind = function (rootContext, element) {
        findBindings(element || window.document.body, { $root: rootContext });
    }

    ist.handlerManager = {
        register: function (name, handler) {
            ist.handlerManager[name] = { name: name, manager: handler };
        },
        get: function (name) {
            return ist.handlerManager[name];
        },
        init: function (element, scope, handler, bindingStatement) {
            var value = getContext(scope, bindingStatement);
            handler.manager.init($(element), scope, value);
        },
        dispose: function (element, scope, handler, bindingStatement, status) {
            if (typeof handler.manager.dispose != 'undefined') handler.manager.dispose($(element), scope, scope != null ? getContext(scope, bindingStatement) : null, status);
        }
    };

    ist.handlerManager.register('using', {
        init: function (element, scope, data, templateId) {
            var childElement = $(ist.templateManager.get(templateId).content);
            if (childElement == null) return;

            var oData = ist.utils.unwrapWatchable(data);

            if (oData)
                createElementForUsing(element, childElement, { $root: scope.$root, $data: oData });

            if (ist.utils.isWatchable(data)) {
                data.watch(function (newValue, oldValue) {
                    if (newValue)
                        createElementForUsing(element, childElement, { $root: scope.$root, $data: newValue });
                    else
                        createElementForUsing(element, childElement, { $root: scope.$root, $data: oldValue }, true);
                });
            }
        },
        dispose: function (element, scope, data) {
            if (data != null) data.unWatch();
            element.empty();
        }
    });

    ist.handlerManager.register('text', {
        init: function (element, scope, data) {
            element.text(ist.utils.unwrapWatchable(data));
            if (ist.utils.isWatchable(data)) {
                data.watch(function (newValue, oldValue) {
                    element.text(newValue);
                }, 2);
            }
        },
        dispose: function (element, scope, data) {
            if (data != null) data.unWatch();
        }
    });

    ist.handlerManager.register('value', {
        init: function (element, scope, data) {
            var selfCall = false;
            element.val(ist.utils.unwrapWatchable(data));
            element.on(ist.defaults.changeEvent, (function () {
                selfCall = true;
                data($(this).val());
            }));

            if (ist.utils.isWatchable(data))
                data.watch(function (newValue, oldValue) {
                    if (selfCall) {
                        selfCall = false;
                        return;
                    }
                    element.val(newValue);
                }, 2);
        },
        dispose: function (element, scope, data) {
            if (data != null) data.unWatch();
            element.off();
        }
    });

    ist.handlerManager.register('visible', {
        init: function (element, scope, data) {
            element.css("display", ist.utils.unwrapWatchable(data) ? "block" : "none");
            if (!ist.utils.isWatchable(data)) return;
            data.watch(function (newValue, oldValue) {
                element.css("display", newValue ? "block" : "none");
            }, 2);
        },
        dispose: function (element, scope, data) {
            if (data != null) data.unWatch();
            element.off();
        }
    });

    ist.handlerManager.register('css', {
        init: function (element, scope, data, status) {
            for (var i = 0; i < data.length; i++) {
                var className = ist.utils.unwrapWatchable(data[i].name);

                if (ist.utils.unwrapWatchable(data[i].value))
                    element.addClass(className);
                else
                    element.removeClass(className);

                if (!ist.utils.isWatchable(data[i].value)) continue;
                if (status == 1) {
                    data[i].value.unWatch();
                    element.off();
                } else {

                    (function (val, cName) {
                        val.watch(function (newValue, oldValue) {
                            if (newValue)
                                element.addClass(cName);
                            else
                                element.removeClass(cName);
                        }, 2);
                    })(data[i].value, className);
                }
            }
        }
    });

    ist.handlerManager.register('checked', {
        init: function (element, scope, data) {
            var selfCall = false;
            element.prop('checked', ist.utils.unwrapWatchable(data));

            element.change(function () {
                selfCall = true;
                data($(this).prop('checked'));
            });

            data.watch(function (newValue, oldValue) {
                if (selfCall) {
                    selfCall = false;
                    return;
                }
                element.prop('checked', newValue);
            }, 2);
        },
        dispose: function (element, scope, data) {
            if (data != null) data.unWatch();
            element.off();
        }
    });

    ist.handlerManager.register('events', {
        init: function (element, scope, data) {
            for (var i = 0; i < data.length; i++)
                element.on(data[i].name, scope.$data, data[i].handler);
        },
        dispose: function (element, scope, data) {
            element.off();
        }
    });

    ist.handlerManager.register('click', {
        init: function (element, scope, data) {
            if (!($._data(element[0], "events") && $._data(element[0], "events")["click"])) {
                element.on('click', function () {
                    data(scope.$data ? scope.$data : scope.$root);
                });
            }
        },
        dispose: function (element, scope, data) {
            element.off();
        }
    });

    ist.handlerManager.register('combobox', {
        init: function (element, scope, data) {
            var items = ist.utils.unwrapWatchable(data.source);

            if (data.caption)
                element.append(new Option(ist.utils.unwrapWatchable(data.caption), null));
            createComboItems(element, items, data.text);

            if (ist.utils.isWatchable(data.source))
                data.source.watch(function (newValue, oldValue) {
                    element.empty();
                    createComboItems(element, items, data.text);
                }, 2);

            if (ist.utils.isWatchable(data.value)) {
                element.change(function () {
                    var itemId = $(this).val();
                    data.value(itemId == null ? null : items[itemId]);
                });
            }
        },
        dispose: function (element, scope, data) {
            element.off();
        }
    });

    ist.handlerManager.register('each', {
        init: function (element, scope, data, templateId) {
            var oData = ist.utils.unwrapWatchable(data);
            if (oData.length > 0)
                createElementForEach(element, oData, scope, templateId);
            if (Array.isArray(oData)) {
                data.watch(function (newValue, oldValue) {
                    if (!Array.isArray(newValue))
                        createElementForEach(element, [newValue], scope, templateId);
                    else {
                        var childs = element.children();
                        if (childs.length > 0) {
                            findBindings(childs, null, true);
                            childs.remove();
                        }
                        createElementForEach(element, newValue, scope, templateId);
                    }
                });
            }
        }
    });

    ist.utils = {
        unwrapWatchable: function (value) {
            return typeof value === "function" ? value() : value;
        },
        isWatchable: function (value) {
            if (!value) return false;
            return typeof value.watch != 'undefined';
        },
        isArrayable: function (value) {
            return (ist.utils.unwrapWatchable(value)) instanceof Array;
        },
        toJS: function (obj) {
            return clone(obj);
        },
        toJSON: function (obj) {
            return JSON.stringify(clone(obj));
        }
    };

    ist.watchable = function () {
        this._subscribers = [];
        this.watch = function (event, type) {
            this._subscribers.push({ type: type, event: event });
        }
        this.unWatch = function () {
            var subs = this._subscribers;
            for (var i = subs.length - 1; i >= 0; i--) {
                if (subs[i].type == 2)
                    this._subscribers.remove(subs[i]);
            }
        }
        this.pub = function (newValue, oldValue) {
            if (this._subscribers.length == 0) return;
            $.each(this._subscribers, function () {
                var retValue = this.event(newValue, oldValue);
                if (this.type == 1)
                    this.event.pub(retValue, oldValue);
            });
        }
    }

    ist.calculated = function (props, handler) {
        $.each(props, function () {
            this.watch(handler, 1);
        });
        ist.watchable.call(handler);
        return handler;
    };

    ist.array = function (initialValue) {
        var lValue = initialValue;
        function array() {
            if (arguments.length == 0)
                return lValue;
            else {
                array.pub(arguments[0], lValue);
                lValue = arguments[0];
                return this;
            }
        }
        array.$t = 1;
        array.add = function (item) {
            item[ist.defaults.elementAttributeName] = ++uniqueId;
            this().push(item);
            item.status = 0;
            this.pub(item, null);
        };
        array.remove = function (item) {
            var arr = this();
            item.status = 1;
            arr.remove(item);
            this.pub(item, null);
        }

        ist.watchable.call(array);
        return array;
    };

    ist.property = function (initialValue) {
        var lValue = initialValue;
        function property() {
            if (arguments.length == 0)
                return lValue;
            else {
                if (lValue != arguments[0]) {
                    var oldValue = lValue;
                    lValue = arguments[0];
                    property.pub(arguments[0], oldValue);
                }
                return this;
            }
        }
        ist.watchable.call(property);
        property.$t = 0;
        return property;
    };

})();

Array.prototype.remove = function (elem) {
    var match = -1;
    while ((match = this.indexOf(elem)) > -1)
        this.splice(match, 1);
};

Array.prototype.filter = function (filter, that) {
    var other = [], v;
    for (var i = 0, n = this.length; i < n; i++) {
        if (i in this && filter.call(that, v = this[i], i, this)) {
            other.push(v);
        }
    }
    return other;
};