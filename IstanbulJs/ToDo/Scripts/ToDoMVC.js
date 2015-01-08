var Todo = function (title, completed) {
    this.title = ist.property(title);
    this.completed = ist.property(completed);
    this.editing = ist.property(false);
};

var ViewModel = function () {
    var self = this;
    this.current = ist.property();
    this.todos = ist.array([]);
    this.allCompleted = ist.property(false);
    this.mode = ist.property('all');
    this.editing = ist.property(false);

    this.add = function () {
        var t = new Todo(self.current(), false);
        t.completed.watch(function () {
            self.completedCount.pub(self.getCompletedCount());
        });
        self.todos.add(t);
        self.current('');
    };

    this.allCompleted.watch(function (value) {
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
        if (self.activeMode())
            return self.todos().filter(function (todo) {
                return !todo.completed();
            });
        else if (self.completedMode())
            return self.todos().filter(function (todo) {
                return todo.completed();
            });
        else
            return self.todos();
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

    self.completedCount = ist.calculated([self.todos], function () {
        return self.getCompletedCount();
    });

    self.remainingCount = ist.calculated([self.todos, self.completedCount], function () {
        return self.todos().length - self.completedCount();
    });

    self.footerVisibility = ist.calculated([self.completedCount, self.remainingCount], function () {
        return self.getCompletedCount() || self.remainingCount();
    });

    self.bodyVisibility = ist.calculated([self.todos], function () {
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

    this.filteredTodos = ist.calculated([this.todos], function () {
        return self.getFilteredTodos();
    });

    this.allMode = ist.calculated([this.mode], function () {
        return self.mode() == 'all';
    });

    this.activeMode = ist.calculated([this.mode], function () {
        return self.mode() == 'active';
    });

    this.completedMode = ist.calculated([this.mode], function () {
        return self.mode() == 'completed';
    });
};

$(function () {
    ist.handlerManager.register('key', {
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
    ist.bind(vm);
});
