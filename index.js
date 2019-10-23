import "./index.css";
import React, { Component } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { Component as YlemComponent } from "ylem";
import reactToWebComponent from "react-to-webcomponent";
import {
    Component as CanComponent, DefineMap, DefineList, fixture, realtimeRestModel, route,
    domEvents, enterEvent
} from "can";

const TodosList = DefineList.extend({
    "#": DefineMap.extend({
        id: "number",
        name: "string"
    })
});

const todoShape = PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired
});

class TodoItem extends Component {
    render() {
        return <div>{this.props.todo.id} -- {this.props.todo.name}</div>
    }
}

TodoItem.propTypes = {
    todo: todoShape.isRequired
}

function ReactToObserveWebComponent(ReactComponent, tagName) {
    class YComponent extends YlemComponent {
        render() {
            return (<ReactComponent {...this.props}></ReactComponent>);
        }
    }

    YlemComponent.propTypes = ReactComponent.propTypes;

    //Just using react-to-web-component
    //const MyComponentWebComponent = reactToWebComponent(ReactComponent, React, ReactDOM);

    //Using ylem + react-to-web-component
    const MyComponentWebComponent = reactToWebComponent(YComponent, React, ReactDOM);

    customElements.define(tagName, MyComponentWebComponent);

    return MyComponentWebComponent;
}

domEvents.addEvent(enterEvent);

const Todo = DefineMap.extend("Todo", {
    id: { type: "number", identity: true },
    name: "string",
    complete: { type: "boolean", default: false }
});

Todo.List = DefineList.extend({
    "#": Todo,
    get active() {
        return this.filter({ complete: false });
    },
    get complete() {
        return this.filter({ complete: true });
    },
    get allComplete() {
        return this.length === this.complete.length;
    },
    get saving() {
        return this.filter(function (todo) {
            return todo.isSaving();
        });
    },
    updateCompleteTo: function (value) {
        this.forEach(function (todo) {
            todo.complete = value;
            todo.save();
        });
    },
    destroyComplete: function () {
        this.complete.forEach(function (todo) {
            todo.destroy();
        });
    }
});

const todoStore = fixture.store([
    { name: "mow lawn", complete: false, id: 5 },
    { name: "dishes", complete: true, id: 6 },
    { name: "learn canjs", complete: false, id: 7 }
], Todo);

fixture("/api/todos", todoStore);
fixture.delay = 300;

realtimeRestModel({
    url: "/api/todos",
    Map: Todo,
    List: Todo.List
});

CanComponent.extend({
    tag: "todo-create",
    view: `
      <input id="new-todo"
        placeholder="What needs to be done?"
        value:bind="todo.name"
        on:enter="createTodo()"/>
    `,
    ViewModel: {
        todo: { Default: Todo },
        createTodo: function () {
            this.todo.save().then(function () {
                this.todo = new Todo();
            }.bind(this));
        }
    }
});

CanComponent.extend({
    tag: "todo-list",
    view: `
      <ul id="todo-list">
        {{# for(todo of this.todos) }}
            <react-todo-item todo:from="todo" 
                isEditing:from="this.isEditing"
                edit:from="this.edit"
                updateName:from="this.updateName"
                cancelEdit:from="this.cancelEdit"
            ></react-todo-item>
        {{/ for }}
      </ul>
    `,
    ViewModel: {
        todos: {
            Type: Todo.List,
            Default: Todo.List,
        },
        editing: Todo,
        backupName: "string",
        isEditing(todo) {
            return todo === this.editing;
        },
        edit(todo) {
            this.backupName = todo.name;
            this.editing = todo;
        },
        cancelEdit() {
            if (this.editing) {
                this.editing.name = this.backupName;
            }
            this.editing = null;
        },
        updateName() {
            this.editing.save();
            this.editing = null;
        }
    }
});

CanComponent.extend({
    tag: "todo-mvc",
    view: `
        <section id="todoapp">
          <header id="header">
            <h1>{{ this.appName }}</h1>
            <todo-create/>
          </header>
          <section id="main" class="">
            <input id="toggle-all" type="checkbox"
              checked:bind="allChecked"
              disabled:from="this.todosList.saving.length"/>
            <label for="toggle-all">Mark all as complete</label>
            <todo-list todos:from="this.todosPromise.value"/>
          </section>
          <footer id="footer" class="">
            <span id="todo-count">
              <strong>{{ this.todosPromise.value.active.length }}</strong> items left
            </span>
            <ul id="filters">
              <li>
                <a href="{{routeUrl(filter=undefined)}}"
                  {{#routeCurrent(filter=undefined)}}class="selected"{{/routeCurrent}}>All</a>
              </li>
              <li>
                <a href="{{routeUrl(filter='active')}}"
                  {{#routeCurrent(filter='active')}}class="selected"{{/routeCurrent}}>Active</a>
              </li>
              <li>
                <a href="{{routeUrl(filter='complete')}}"
                  {{#routeCurrent(filter='complete')}}class="selected"{{/routeCurrent}}>Completed</a>
              </li>
            </ul>
            <button id="clear-completed"
              on:click="this.todosList.destroyComplete()">
              Clear completed ({{ this.todosPromise.value.complete.length }})
            </button>
          </footer>
        </section>
    `,
    ViewModel: {
        appName: { default: "TodoMVC" },
        routeData: {
            default() {
                route.register("{filter}");
                route.start();
                return route.data;
            }
        },
        get todosPromise() {
            if (!this.routeData.filter) {
                return Todo.getList({});
            } else {
                return Todo.getList({ filter: { complete: this.routeData.filter === "complete" } });
            }
        },
        todosList: {
            get: function (lastSet, resolve) {
                this.todosPromise.then(resolve);
            }
        },
        allChecked: {
            type: "boolean",
            get(lastVal) {
                return this.todosList && this.todosList.allComplete;
            },
            set(newVal) {
                this.todosList && this.todosList.updateCompleteTo(newVal);
            }
        }

    }
});

class ReactTodoItem extends React.Component {
    render() {
        const todo = this.props.todo;
        let classes = "todo ";
        classes += todo.complete ? "completed " : "";
        classes += todo.isDestroying && todo.isDestroying() ? "destroying " : "";
        classes += this.props.isEditing && this.props.isEditing(todo) ? "editing " : "";

        return <li className={classes}>
            <div className="view">
                <input className="toggle" type="checkbox" checked={todo.complete} onChange={(ev) => {
                    todo.complete = ev.target.checked;
                    todo.save()
                }} />
                <label onDoubleClick={() => this.props.edit(todo)}>{todo.name}</label>
                <button className="destroy" onClick={() => todo.destroy()}></button>
            </div>
            <input className="edit" type="text" value={todo.name} onChange={ev => todo.name = ev.target.value}
                onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                        this.props.updateName();
                    }

                    if (ev.key === "Escape") {
                        this.props.cancelEdit()
                    }
                }}
                onBlur={() => this.props.cancelEdit()}
            />
        </li>;
    }
}

ReactTodoItem.defaultProps = {
    isEditing: () => { },
    edit: () => { },
    updateName: () => { },
    cancelEdit: () => { }
}

ReactTodoItem.propTypes = {
    todo: PropTypes.oneOfType([
        PropTypes.shape({
            id: PropTypes.number,
            name: PropTypes.string,
            complete: PropTypes.boolean
        }),
        PropTypes.string
    ]),
    isEditing: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func
    ]),
    edit: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func
    ]),
    updateName: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func
    ]),
    cancelEdit: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func
    ]),
};

ReactToObserveWebComponent(ReactTodoItem, "react-todo-item");