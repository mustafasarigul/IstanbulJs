(function () {
    window.ist = { defaults: { attributePrefix: 'data-bind-', changeEvent: 'keyup', elementAttributeName: 'ist_Id' } };
    var templates = [], uniqueId = 0, bindingCache = {};

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

    function getBindingValue(statement) {
        var methodBody = "with($root){with($data||{}){return " + statement + "}}";
        return bindingCache[statement] || (bindingCache[statement] = new Function("$root", "$data", methodBody));
    }

    function isBlackListStatement(statement, type) {
        var blackListChars = [32, 43, 44, 91, 93, 123, 125, 45, 47, 42, 37, 38, 33, 60, 61, 62, 63, 58];
        var blackListCommands = ['null', 'if', 'switch', 'else', 'for', 'return', 'true', 'false', 'function', 'throw', 'new', 'with', 'while', 'typeof', 'instanceOf', 'eval', 'Function'];
        var list = type == 0 ? blackListChars : blackListCommands;
        for (var i = 0; i < list.length; i++)
            if (statement == list[i]) return true;
        return false;
    }

    function getWatchables(statement) {
        statement = statement.replace(/'(.*?)'/i, "");
        var tmp = "", funcs = [];

        for (var i = 0; i < statement.length; i++) {
            var code = statement[i].charCodeAt();
            if (i == statement.length - 1 && !isBlackListStatement(code, 0)) {
                tmp += statement[i];
                funcs.push(tmp);
            }

            if (isBlackListStatement(code, 0)) {
                if (tmp.length > 0)
                    if (isNaN(tmp)) {
                        if (!isBlackListStatement(tmp, 1)) {
                            funcs.push(tmp);
                        }
                    }
                tmp = "";
            } else
                tmp += statement[i];
        }
        return funcs;
    }

    function getWatchableDataItems(scope, bindingStatement,elementHandler) {
        var dataItems = [], handler,value;
        var statements = getWatchables(bindingStatement);

        for (var i = 0; i < statements.length; i++) {
            var index = statements[i].lastIndexOf('.');
            if (index < 0) {
                try {
                    handler = getBindingValue(statements[i]);
                    value = handler(scope.$root, scope.$data);
                    if (ist.utils.isWatchable(value) && handler != elementHandler)
                        dataItems.push({ statement: statements[i], value: value });
                }
                catch(ex){}
            }
            while (index > 0) {
                statements[i] = statements[i].substring(0, index);
                index = statements[i].lastIndexOf('.');
                if (statements[i] != '$root' && statements[i] != '$data') {
                    var statement = statements[i].substring(statements[i].length, statements[i].length - 2);
                    if (statement == '()')
                        statement = statements[i].substring(0, statements[i].length - 2);
                    try {
                        handler = getBindingValue(statement);
                        value = handler(scope.$root, scope.$data);
                        if (ist.utils.isWatchable(value) && handler!=elementHandler) {
                            if (dataItems.filter(function (item) {
                                return item.statement == statement;
                            }).length == 0)
                                dataItems.push({ statement: statement, value: value });
                        }
                    } catch (e) {} 
                }
            }
        }
        return dataItems;
    }

    function findBindings(currentNode, scope, dispose) {
        var attributes = [], handlerName;
        if (currentNode.attributes && currentNode.attributes.length > 0) {
            for (var a = 0; a < currentNode.attributes.length; a++)
                attributes.push({ localName: currentNode.attributes[a].localName, nodeValue: currentNode.attributes[a].nodeValue });

            for (var i = 0; i < attributes.length; i++) {
                if (attributes[i].localName.indexOf(ist.defaults.attributePrefix) == -1) continue;
                handlerName = attributes[i].localName.replace(ist.defaults.attributePrefix, '');
                if (handlerName == 'using') {
                    ist.handlerManager.init(handlerName, $(currentNode), scope, attributes[i].nodeValue, ist.templateManager.register($(currentNode)));
                    currentNode = currentNode.nextSibling;
                    break;
                }
                if (handlerName == 'each') {
                    ist.handlerManager.init(handlerName, $(currentNode), scope, attributes[i].nodeValue, ist.templateManager.register($(currentNode)));
                    currentNode = currentNode.nextSibling;
                    break;
                }
                else {
                    if (dispose)
                        ist.handlerManager.dispose(handlerName, $(currentNode), scope, attributes[i].nodeValue);
                    else
                        ist.handlerManager.init(handlerName, $(currentNode), scope, attributes[i].nodeValue);
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
        if (obj == null || typeof obj != "object") return obj;
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
        init: function (name, element, scope, bindingStatement, templateId) {
            var value = getBindingValue(bindingStatement);
            var watchables = getWatchableDataItems(scope, bindingStatement,value);
            var args = { scope: scope, handler: value, value: value(scope.$root, scope.$data), watchables: watchables, templateId: templateId };
            ist.handlerManager[name].init($(element), args);
        },
        dispose: function (name, element, scope, handler, bindingStatement, status) {
            if (typeof ist.handlerManager[name].dispose != 'undefined') ist.handlerManager[name].dispose($(element), scope, scope != null ? getBindingValue(bindingStatement) : null, status);
        }
    };

    ist.handlerManager.using = {
        init: function (element, scope, data, templateId) {
            var childElement = $(ist.templateManager.get(args.templateId).content);
            if (childElement == null) return;

            var oData = ist.utils.unwrapWatchable(args.value);

            if (oData)
                createElementForUsing(element, childElement, { $root: args.scope.$root, $data: oData });

            if (ist.utils.isWatchable(args.value)) {
                args.value.watch(function (newValue, oldValue) {
                    if (newValue)
                        createElementForUsing(element, childElement, { $root: args.scope.$root, $data: newValue });
                    else
                        createElementForUsing(element, childElement, { $root: args.scope.$root, $data: oldValue }, true);
                });
            }
        },
        dispose: function (element, args) {
            if (args.value != null) args.value.unWatch();
            element.empty();
        }
    };

    ist.handlerManager.text = {
        init: function (element, args) {
            element.text(ist.utils.unwrapWatchable(args.value));

            for (var i = 0; i < args.watchables.length; i++) {
                args.watchables[i].value.watch(function (newValue, oldValue) {
                    element.text(newValue);
                }, 2);
            }

            if (ist.utils.isWatchable(args.value)) {
                args.value.watch(function (newValue, oldValue) {
                    element.text(newValue);
                }, 2);
            }
        },
        dispose: function (element, args) {
            if (args.value != null) args.value.unWatch();
        }
    };

    ist.handlerManager.value = {
        init: function (element, args) {
            var selfCall = false;
            element.val(ist.utils.unwrapWatchable(args.value));
            element.on(ist.defaults.changeEvent, (function () {
                selfCall = true;
                args.value($(this).val());
            }));

            if (ist.utils.isWatchable(args.value))
                args.value.watch(function (newValue, oldValue) {
                    if (selfCall) {
                        selfCall = false;
                        return;
                    }
                    element.val(newValue);
                }, 2);
        },
        dispose: function (element, args) {
            if (args.value != null) args.value.unWatch();
            element.off();
        }
    };

    ist.handlerManager.visible = {
        init: function (element, args) {
            element.css("display", ist.utils.unwrapWatchable(args.value) ? "block" : "none");
            for (var i = 0; i < args.watchables.length; i++) {
                args.watchables[i].value.watch(function (newValue, oldValue) {
                    element.css("display", ist.utils.unwrapWatchable(args.handler(args.scope.$root, args.scope.$data)) ? "block" : "none");
                }, 2);
            }
            if (!ist.utils.isWatchable(args.value)) return;
            args.value.watch(function (newValue, oldValue) {
                element.css("display", newValue ? "block" : "none");
            }, 2);
        },
        dispose: function (element, args) {
            if (args.value != null) args.value.unWatch();
            element.off();
        }
    };

    ist.handlerManager.css = {
        init: function (element, args) {
            for (var i = 0; i < args.value.length; i++) {
                var className = ist.utils.unwrapWatchable(args.value[i].name);

                if (ist.utils.unwrapWatchable(args.value[i].value))
                    element.addClass(className);
                else
                    element.removeClass(className);

                if (!ist.utils.isWatchable(args.value[i].value)) continue;
                (function (val, cName) {
                    val.watch(function (newValue, oldValue) {
                        if (newValue)
                            element.addClass(cName);
                        else
                            element.removeClass(cName);
                    }, 2);
                })(args.value[i].value, className);
            }
        },
        dispose: function (element, args) {
            for (var i = 0; i < args.value.length; i++) {
                args.value[i].value.unWatch();
                element.off();
            }
        }
    };

    ist.handlerManager.checked = {
        init: function (element, args) {
            var selfCall = false;
            element.prop('checked', ist.utils.unwrapWatchable(args.value));

            element.change(function () {
                selfCall = true;
                args.value($(this).prop('checked'));
            });

            args.value.watch(function (newValue, oldValue) {
                if (selfCall) {
                    selfCall = false;
                    return;
                }
                element.prop('checked', newValue);
            }, 2);
        },
        dispose: function (element, args) {
            if (args.value != null) args.value.unWatch();
            element.off();
        }
    };

    ist.handlerManager.events = {
        init: function (element, args) {
            for (var i = 0; i < args.value.length; i++)
                element.on(args.value[i].name, args.scope.$data, args.value[i].handler);
        },
        dispose: function (element, args) {
            element.off();
        }
    };

    ist.handlerManager.click = {
        init: function (element, args) {
            if (!($._data(element[0], "events") && $._data(element[0], "events")["click"])) {
                element.on('click', function () {
                    args.value(args.scope.$data ? args.scope.$data : args.scope.$root);
                });
            }
        },
        dispose: function (element, args) {
            element.off();
        }
    };

    ist.handlerManager.combobox = {
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
    };

    ist.handlerManager.each = {
        init: function (element, args) {
            var oData = ist.utils.unwrapWatchable(args.value);
            if (oData.length > 0)
                createElementForEach(element, oData, args.scope, args.templateId);
            if (Array.isArray(oData)) {
                args.value.watch(function (newValue, oldValue) {
                    if (!Array.isArray(newValue))
                        createElementForEach(element, [newValue], args.scope, args.templateId);
                    else {
                        var childs = element.children();
                        if (childs.length > 0) {
                            findBindings(childs, null, true);
                            childs.remove();
                        }
                        createElementForEach(element, newValue, args.scope, args.templateId);
                    }
                });
            }
        }
    };

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
    for (var i = 0, n = this.length; i < n; i++)
        if (i in this && filter.call(that, v = this[i], i, this))
            other.push(v);
    return other;
};