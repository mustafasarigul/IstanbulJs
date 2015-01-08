var Todo = function (title, completed) {
    this.title = bb.property(title);
    this.completed = bb.property(completed);
    this.editing = bb.property(false);
};

var ViewModel = function () {
    var self = this;
    this.current = bb.property();
    this.todos = bb.array([]);
    this.allCompleted = bb.property(false);
    this.mode = bb.property('all');
    this.editing = bb.property(false);

    this.add = function () {
        var t = new Todo(self.current(), false);
        t.completed.watch(function () {
            self.completedCount.pub(self.getCompletedCount());
        });
        self.todos.add(t);
        self.current('');
    };

    this.allCompleted.watch(function(value) {
        for (var i = 0; i < self.todos().length; i++) 
            self.todos()[i].completed(value);
    });

    this.editItem = function (item) {
        item.data.editing(true);
        item.data.previousTitle = item.data.title();
    };

    this.getCompletedCount = function () {
        return self.todos().filter(function (todo) {
            return todo.completed();
        }).length;
    }

    this.getFilteredTodos = function () {
        switch (self.mode()) {
            case 'active':
                return self.todos().filter(function (todo) {
                    return !todo.completed();
                });
            case 'completed':
                return self.todos().filter(function (todo) {
                    return todo.completed();
                });
            default:
                return self.todos();
        }
    }

    this.removeCompleted = function () {
        for (var i = self.todos().length - 1; i >= 0; i--) {
            if (self.todos()[i].completed())
                self.todos().remove(self.todos()[i]);
        }
        self.filteredTodos.pub(self.getFilteredTodos());
    };

    this.stopEditing = function (item) {
        item.data.editing(false);

        var title = item.data.title();
        var trimmedTitle = title.trim();

        if (title !== trimmedTitle) {
            item.data.title(trimmedTitle);
        }

        if (!trimmedTitle) {
            this.remove(item);
        }
    };

    self.completedCount = bb.calculated([self.todos], function () {
        return self.getCompletedCount();
    });

    self.remainingCount = bb.calculated([self.todos, self.completedCount], function () {
        return self.todos().length - self.completedCount();
    });

    self.footerVisibility = bb.calculated([self.completedCount, self.remainingCount], function () {
        return self.getCompletedCount() || self.remainingCount();
    });

    self.bodyVisibility = bb.calculated([self.todos], function () {
        return self.todos().length > 0;
    });

    this.remove = function (todo) {
        self.todos.remove(todo);
    };

    this.showAllItems = function () {
        self.mode('all');
        self.allMode(true);
        self.filteredTodos.pub(self.getFilteredTodos());
    };

    this.showActiveItems = function () {
        self.mode('active');
        self.activeMode(true);
        self.filteredTodos.pub(self.getFilteredTodos());
    };

    this.showCompletedItems = function () {
        self.completedMode(true);
        self.mode('completed');
        self.filteredTodos.pub(self.getFilteredTodos());
    };

    this.filteredTodos = bb.calculated([this.todos], function () {
        return self.todos();
    });

    this.allMode = bb.calculated([this.mode],function() {
        return self.mode() == 'all';
    });

    this.activeMode = bb.calculated([this.mode], function () {
        return self.mode() == 'active';
    });

    this.completedMode = bb.calculated([this.mode], function () {
        return self.mode() == 'completed';
    });
};

$(function () {
    bb.handlerManager.register('key', {
        init: function (element, scope, data) {
            for (var i = 0; i < data.length; i++) {
                (function (d) {
                    element.on('keydown', scope, function (args) {
                        if (args.keyCode == d.x)
                            d.handler({ data: scope.$data });
                    });
                })(data[i]);
            }
        }
    });

    var vm = new ViewModel();
    bb.bind( document.getElementById("todoapp"), vm);
});
