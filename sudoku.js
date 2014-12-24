/*
 * Overall structures (Models on the up uses/manages several instances of models on the bottom):
 *
 *
 *                                      +------------------------------+----+
 *                                      |                                   |
 *                                      |  SudokuGameViewModel: switching   |
 *                                      |  between the following three modes|
 *                                      |                                   |
 *                                      +----------------+------------------+-
 *                             ----------/               |                    \------
 *                 -----------/                          |                           \------
 *      +---------/---------------+      +---------------+--------------+    +--------------\-----------+
 *      |                         |      |                              |    |                          |
 *      | PlayModeViewModel:      |      | GameEditorViewModel:         |    | PuzzleListViewModel:     |
 *      |   play sudoku game      |      |   Edit new games by key in   |    |   Choose puzzle from a   |
 *      |                         |      |   the numbers                |    |   list                   |
 *      +--------+----------------+      +---------------+--------------+    +--------------------------+
 *               |   \------                             |                           ----/
 *               |          \-------                     |                      ----/
 *               |                  \------              |                -----/
 *               |                         \------       |           ----/
 *      +--------+----------------+      +--------\------+----------/-----+--+
 *      | UserList:               |      |                                   |
 *      |   Manage the list of    |      | BoardViewModel:                   |
 *      |   users                 |      |   Manage the state and appearance |
 *      |                         |      |   of the board                    |
 *      +-------------------------+      +---------------+-------------------+
 *                                                       |A list of
 *                                                       |CellState
 *    +------------------------+         +---------------+-------------------+
 *    |                        |         | CellStateViewMode:                |
 *    |  Palette: colors used  |<--------+   Manage the state and appreance  |
 *    |  by CellState          |         |   of one cell                     |
 *    +------------------------+         +-----------------------------------+
 *
 *
 *
 */
/*
 * Empty implementations of the google+ hangout data API
 */
window.HANGOUTAPI = {
  clearValue: function (key) {},
  setValue: function (key, value) {},
  submitDelta: function(opt_updates, opt_removes) {},
  sendMessage: function(message) {}
};

var strings = {
  'en': {
    'title': 'SUDOKU',
    'newGame': 'New Game',
    'restart': 'Restart',
    'resConfirm': 'Are you sure to start over?',
    'resWarning': 'Restart the puzzle will lost all the progresses you have made!',
    'cancel': 'Cancel',
    'start': 'Start',
    'hint': 'The heart shaped puzzle is puzzle #51.',
    'listtitle': 'Puzzle ID:',
    'List': 'List',
    'Edit': 'Edit'
  },
  'zh-CN': {
    'title': '数独',
    'newGame': '新谜题',
    'restart': '重置',
    'resConfirm': '确定重新开始？',
    'resWarning': '重新开始会失去所有已经完成的部分．',
    'cancel': '取消',
    'start': '开始',
    'hint': '心形题的编号是５１．',
    'listtitle': '谜题编号',
    'List': '选择',
    'Edit': '输入'
  }
};
/*
 * Global variable that controls state update and message sending
 */


/*
 * Here are the keys in the shared state of the app, a list of
 * functions in which the state will be changed and the meaning of the
 * key.
 *
 * mode: (mode.start) The mode of the app (play, edit or list)
 *
 * c0#0, c0#1, ..., c8#8: (Cell.removeOrAddValue) The state of each cell, it's
 *     json object {value: [...], owner: ''}.
 *
 * gameString: (BoardViewModel.setBoardState)the game string of the board.
 *
 * puzzleID: (PuzzleListViewModel.updateBoard) the id of current selected puzzle,
 *
 * A note about owner: (SudokuGameViewModel.switchToMode) Operations to
 * create/choose new game can only performed by one player (called
 * owner) and others can only discuss with the owner. The first user
 * started such actions is the owner, and the owner is set to '' when
 * the mode changed back to play.
 */

/*
 * There are some informations need to be kept for any specific user:
 *
 * name: will be shown in team member list
 * state: bool value, decides if the user's highlight will be shown
 */
var User = function(id, name, follow) {
  var self = this;
  this.name = name;
  this.id = id;
  this.follow = ko.observable(follow);
  this.toggleState = function() {
    self.follow(!self.follow());
  };
};

/*
 * User list, mapping a user id to color setting
 */
var UserList = function() {
  var self = this;
  this.userList = ko.observableArray();
  this.userMap = Object.create(null);
  this.localUser = ko.observable('');
  this.colorMap = Object.create(null);

  this.addUser = function(id, name) {
    if (!self.userMap[id]) {
      var newUser = new User(id, name, false);
      self.userList.push(newUser);
      self.userMap[id] = newUser;
      if (!self.colorMap[id]) {
        self.colorMap[id] = palette.randomColor();
      };
    }
  };

  this.addUsers = function(ulist) {
    for (var i=0; i<ulist.length; ++i) {
      var user = ulist[i];
      self.addUser(user.id, user.person.displayName);
    }
  };

  this.removeUser = function(id) {
    delete self.userMap[id];
    delete self.colorMap[id];
    var users = self.userList();
    for (var i=0; i<users.length; ++i) {
      var user = users[i];
      if (user.id == id) {
        self.userList.splice(i, 1);
        return;
      }
    }
  };

  this.removeUsers = function(ulist) {
    for (var i=0; i<ulist.length; ++i) {
      self.removeUser(ulist[i].id);
    }
  };

  this.toggleState = function(uid) {
    self.userMap[uid].toggleState();
  };

  this.enabled = function(uid) {
    return self.userMap[uid].follow();
  };

  this.getBackground = function(uid) {
    return self.colorMap[uid];
  };
};

/*
 * Create normal color and dimmed color used for highlighting cells.
 */
var palette = {
  normalColor:  {
    'pointer': '#a0c5e8',
    'focused': '#60e069',
    'peerHLD': '#c3f3f7',
    'white': '#ffffff'
  }
};

/*
 * Dimmed version of above colors
 */
palette.dimmedColors = (function maskWithColor(mask) {
  function hexToRGB(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  function maskedColor(color, mask) {
    color = hexToRGB(color);
    mask = hexToRGB(mask);
    var r = Math.round(color.r * mask.r / 256);
    var g = Math.round(color.g * mask.g / 256);
    var b = Math.round(color.b * mask.b / 256);

    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var nc = palette.normalColor;
  return {
    'pointer': maskedColor(nc['pointer'], mask),
    'focused': maskedColor(nc['focused'], mask),
    'peerHLD': maskedColor(nc['peerHLD'], mask),
    'white': maskedColor(nc['white'], mask)
  };
})('#dddddd');

palette.randomColor = function() {
  var letters = '0123456789ABCDEF'.split('');
  var color = '#';
  for (var i = 0; i < 6; i++ ) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

/*
 * Represents the information in one cell.
 */
var CellState = function(i, j) {
  var self = this;
  // position
  this.i = i;
  this.j = j;
  // assigned values
  this.values = ko.observableArray();

  // who has the right to change it
  this.owner = ko.observable(undefined);
  this.localUser = undefined;

  // bookkeeping variables for highlighting, correctness check
  this.isGiven = ko.observable(false);         // whether this cell is given at the start
  this.conflictCount = ko.observable(0);       // conflict with how many other cells
  this.peerHighlight = ko.observable(false);
  this.isFocused = ko.observable(false);       // is it the cell that accepting input
  this.valueHighlight = ko.observable(false);
  this.pointerHighlight = ko.observable(false);
  this.isNotMarker = ko.computed(function isNotMarker() {
    return self.values().length == 1;
  }, this);
  this.key = 'C' + i + '#' + j;       // used to encode the game state

  // colors used for the background of different kind of cells
  this.colors = ko.computed(function getColorSet() {
    return self.isGiven() ? palette.dimmedColors : palette.normalColor;
  }, this);

  /*
   * background of the cell has the following possible values, from lowest priority:
   * 1. normal color: white
   * 2. given cell: #dddddd
   * 3. highlighted cell
   * 4. focused cell: input will go into this cell
   * 5. pointer: mouse is pointing to this cell
   */
  this.background = ko.computed(function background() {
    var colors = self.colors();
    return ((self.pointerHighlight() && colors['pointer']) ||
            (self.isFocused()        && colors['focused']) ||
            (self.peerHighlight()    && colors['peerHLD']) ||
            (true                    && colors['white']));
  }, this);

  /*
   * color has three possible values, from lowest priority:
   * 1. normal color: black
   * 2. highlighted value
   * 3. conflict: red
   */
  this.color = ko.computed(function color() {
    return ((self.conflictCount() > 0 && '#ff0000') ||
            (self.valueHighlight()    && '#0000ff') ||
            (true                     && '#000000'));
  }, this);

  this.showOwnerFlag = ko.computed(function showOwnerFlag() {
    return self.localUser && self.allowToChange();
  }, this);

  // border classes to draw wider borders for square units
  this.borderClass = (function boardClass() {
    var leftBorder = (j%3 == 0);
    var rightBorder = (j+1)%3==0;
    var topBorder = (i%3 == 0);
    var bottomBorder = ((i+1)%3==0);
    var result = 'cell';
    if (leftBorder) result += ' cell-left-border';
    if (rightBorder) result += ' cell-right-border';
    if (bottomBorder) result += ' cell-bottom-border';
    if (topBorder) result += ' cell-top-border';
    return result;
  })();


  /*
   * stringValue: combine the values into a single string,
   * to be shown in the cell.
   */
  this.stringValue = ko.computed(function toString() {
    return self.values().join(' ');
  });

  this.setValue = function(values) {
    self.values.removeAll();
    self.values.push.apply(self.values, values);
  };
  /*
   * Set the state of cell
   *
   * values is an array of values, and isGiven is a bool.
   */
  this.setState = function(values, isGiven, owner) {
    self.setValue(values);
    self.isGiven(isGiven);
    self.conflictCount(0);
    self.peerHighlight(false);
    self.isFocused(false);
    self.valueHighlight(false);
    self.owner(owner);
  };

  this.init = function(initValue, currentState) {
    var isGiven = initValue != undefined && initValue >= '1' && initValue <= '9';
    var givenValue = isGiven?[initValue]:[];
    var currentValues = (currentState && currentState.value) || givenValue;
    var owner = (currentState && currentState.owner) || undefined;
    self.setState(currentValues, isGiven, owner);
  };

  this.getState = function() {
    var state = Object.create(null);
    state.value = self.values();
    state.owner = self.owner();
    return state;
  };
  this.allowToChange = function() {
    return (self.owner() == undefined || self.owner() == self.localUser);
  };
  /*
   * Get the first value from the value list.
   */
  this.getValue = function() {
    return self.values()[0];
  };

  /*
   * remove or add value v to the cells value list
   * 1. if v is '0', clear all values
   * 2. if v in values, remove it.
   * 3. Otherwise, add v to values.
   *
   * Since changing the value list of the cell may cause new
   * conflicts with other cells, or some old conflicts may be
   * resolved, this function will return an object {value: v, delta:
   * i}, where v is the value may involved in conflicts, and delta
   * represents how conflicts will change (create new conflict
   * or resolve old ones).
   *
   * Using the returned value, the caller can perform further checks
   * for conflicts.
   */
  this.removeOrAddValue = function(v) {
    // if the cell is given, do not change
    if (self.isGiven()) return null;
    // if the cell has owner and the cell's owner is not localUser, do not change
    if (!self.allowToChange()) return null;

    var result = null;
    if (v == '0') {
      result = self.updateValue([]);
    } else {
      var values = self.values().slice(0);
      var idx = 0;
      // find the position to insert v
      while (idx < values.length && v > values[idx]) ++idx;

      if (idx < values.length && v == values[idx]) {
        values.splice(idx, 1);
      } else {
        values.splice(idx, 0, v);
      }
      result = self.updateValue(values, self.localUser);
    }
    HANGOUTAPI.setValue(self.key, {value: self.values(), owner: self.localUser});
    return result;
  };

  this.updateValue = function(values, owner) {
    var conflictPotential = {};
    if (values.length == 1) {
      conflictPotential['new'] = values[0];
    }
    if (self.values().length == 1) {
      conflictPotential['old'] = self.getValue();
    }
    self.setValue(values);
    self.owner(owner);
    return conflictPotential;
  };
};

/*
 * BoardViewModel manages a game board, which consists 9x9 cells.
 */

var BoardViewModel = function(row, col) {
  var self = this;

  // board dimensions
  this.row = row;
  this.col = col;
  // row x col CellState objects in an rowxcol grid
  this.cells = (function() {
    var result = [];
    for (var i=0; i<row; i++) {
      var newRow = [];
      for (var j=0; j<col; j++) {
        newRow.push(new CellState(i, j));
      }
      result.push(newRow);
    }
    return result;
  })();

  this.done = ko.observable(false);
  this.done.subscribe(function(value) {
    $(document).trigger('done', [value]);
  });
  this.initGameString = '';

  /*
   * forAllCells: apply a function to all cells in the board.
   *
   * f is a function that accepts (i, j, cell).
   */
  this.forAllCells = function(f) {
    var rowCount = self.cells.length;
    for (var i=0; i<rowCount; ++i) {
      var row = self.cells[i];
      var colCount = row.length;
      for (var j=0; j<colCount; ++j) {
        f(i, j, row[j]);
      }
    }
  };

  this.setLocalUser = function(localUser) {
    self.forAllCells(function(i, j, cell) {
      cell.localUser = localUser;
    });
  };
  /*
   * set game board state, given a string representation of a sudoku
   * game, optionally with an object whose keys in the form like
   * 'ci#j', where i, j are digits from 1 to 9, representing the
   * current values filled in cell(i, j).
   */
  this.setBoardState = function(gameState) {
    var gameString = gameState['gameString'];
    self.initGameString = gameString;
    gameState = gameState || {};
    self.forAllCells(function(i, j, cell) {
      var initValue = gameString[i*self.row+j];
      var cellState = gameState[cell.key];
      var currentState = cellState?JSON.parse(cellState):null;
      cell.init(initValue, currentState);
    });
  };

  this.reset = function() {
    self.setBoardState({gameString: self.initGameString});

  };

  this.gameStringFromCells = function() {
    var result = [];
    self.forAllCells(function(i, j, cell) {
      result.push(cell.getValue() || '.');
    });
    for (var i=72; i>0; i-=9) {
      result.splice(i, 0, '\n');
    }
    return result.join('');
  };

  /*
   * Actions after changing a cell's value
   */
  this.afterChangeCell = function(i, j, conflictPotential) {
    if (conflictPotential != null) {
      self.conflictCheck(i, j, conflictPotential);
    }
    if (self.cells[i][j].isNotMarker()) {
      self.highlightByValue(self.cells[i][j].getValue());
    }
  };

  /*
   * Add a value v to a given cell(i, j). If this may cause the number
   * of confliction change, check the conflicts again.
   */
  this.removeOrAddValue = function(i, j, v) {
    var conflictPotential = this.cells[i][j].removeOrAddValue(v);
    self.afterChangeCell(i, j, conflictPotential);
  };

  /*
   * Set the value of given cell
   */
  this.updateCell = function(i, j, values, lastWriter) {
    var conflictPotential = self.cells[i][j].updateValue(values, lastWriter);
    self.afterChangeCell(i, j, conflictPotential);
  };
  /*
   * Test if two given cells are peers in rows, columns or squrares
   */
  this.isPeer = function(i1, j1, i2, j2) {
    return ((i1 != i2 || j1 != j2) && // not the same cell AND
            (i1 == i2 || // same row OR
             j1 == j2 || // same column OR
             (Math.floor(i1/3)==Math.floor(i2/3) &&
              Math.floor(j1/3)==Math.floor(j2/3))));  // same square
  };

  /*
   * Check conflict between cell(row, col) and all other cells,
   * assuming cell(row, col) has value v.
   *
   * If any other cell also has the value v, increase that cell's
   * conflictCount by delta. (delta may be -1, which means an
   * conflict caused by v is resolved).
   */
  this.conflictCheck = function(row, col, newChange) {
    var newValue = newChange['new'];
    var oldValue = newChange['old'];

    var filled = 0;
    var conflict = 0;
    var currentCell = self.cells[row][col];
    self.forAllCells(function updateConfliction(i, j, cell) {
      filled += cell.isNotMarker()?1:0;
      var isPeer = self.isPeer(i, j, row, col);
      if (isPeer && cell.isNotMarker()) {
        var otherValue = cell.getValue();
        var delta = 0;
        if (newValue == otherValue) {
          delta += 1;        // the other cell's conflict count +1
          conflict += 1;     // total conflict change +1
        }
        if (oldValue == otherValue) {
          delta -= 1;        // the other cell's conflict count -1
          conflict -= 1;     // total conflict change -1
        }
        cell.conflictCount(cell.conflictCount()+delta);
        currentCell.conflictCount(currentCell.conflictCount()+delta);
      }
      conflict += cell.conflictCount();
    }, false);
    self.done(filled == 81 && conflict == 0);
  };

  this.withOthers = true;
  /*
   * Highlight all cells that satisfies a given condition f, if
   * withOthers is true, this highlight can coexist with other
   * highlights.
   *
   * Return a flag array shows which numbers are missing in the highlighted cells.
   *
   * f is a function that takes the cells position (row, col) as
   * parameter, and return a boolean.
   */
  this.highlightCells = function(f, withOthers) {
    self.focusedCell = null;
    var missing = [true, true, true, true, true, true, true, true, true];
    self.forAllCells(function(i, j, cell) {
      cell.isFocused(false);
      if (f(i, j)) {
        cell.peerHighlight(true);
        if (cell.isNotMarker()) {
          missing[cell.getValue()-1] = false;;
        }
      } else {
        // only keep the old highlights when both the new and old
        // highlights agree to coexist with others.
        if (!(self.withOthers && withOthers)) {
          cell.peerHighlight(false);
        }
      }
    });
    self.withOthers = withOthers;
    return missing;
  };

  /*
   * Highlight a given row, col, square or all of three. Also return a
   * flag array, indicating which number is missing in the highlighted
   * cells.
   */
  this.highlightRow = function(row) {
    return self.highlightCells(function sameRow(i, j) {return i==row;}, true);
  };

  this.highlightCol = function(col) {
    return self.highlightCells(function sameCol(i, j) {return j==col;}, true);
  };

  this.highlightSquare = function(row, col) {
    return self.highlightCells(function sameSquare(i, j) {
      return Math.floor(j/3)==col && Math.floor(i/3)==row;
    }, false);
  };
  this.focusedCell = null;
  this.selectCell = function(row, col) {
    var missing = self.highlightCells(function(i, j) {
      return self.isPeer(i, j, row, col);
    }, false);
    self.cells[row][col].isFocused(true);
    // if the cell contains given value, no need to show missing values
    if (self.cells[row][col].isGiven()) {
      missing = [];
    }
    self.focusedCell = self.cells[row][col];
    return missing;
  };

  /*
   * Highlight all cells that is assigned value v.
   */
  this.highlightByValue = function(v) {
    self.forAllCells(function hasValue(i, j, cell) {
      var highlight = cell.isNotMarker() && cell.getValue() == v;
      cell.valueHighlight(highlight);
    });
    return null;
  };

  /*
   * Highlight cells, accepts an object that has the following format:
   * { type: 'row', // can be 'row', 'col', 'square', 'cell', 'value'
   *   row: 4,
   *   col: 5,
   *   value: 4     // only used when type is 'value'
   * }
   */
  this.highlightUnit = function(unit) {
    var missing;
    switch (unit.type) {
    case 'row':
      missing = self.highlightRow(unit.row);
      break;
    case 'col':
      missing = self.highlightCol(unit.col);
      break;
    case 'square':
      missing = self.highlightSquare(unit.row, unit.col);
      break;
    case 'cell':
      missing = self.selectCell(unit.row, unit.col);
      break;
    case 'value':
      missing = self.highlightByValue(unit.value);
      break;
    case 'null':
      missing = self.removeHighlights();
    }
    return missing;
  };


  /*
   * set a cell to pointer
   */
  this.setPointer = function(row, col) {
    if (self.previousPointerRow != undefined) {
      self.cells[self.previousPointerRow][self.previousPointerCol].pointerHighlight(false);
    }
    self.cells[row][col].pointerHighlight(true);
    self.previousPointerRow = row;
    self.previousPointerCol = col;
  };
  /*
   * Remove all highlights
   */
  this.removeHighlights = function() {
    self.highlightCells(function(i,j) {return false;}, false);
    self.highlightByValue(null);
    if (self.previousPointerRow != undefined) {
      self.cells[self.previousPointerRow][self.previousPointerCol].pointerHighlight(false);
      self.previousPointerCol = undefined;
      self.previousPointerRow = undefined;
    }
    self.withOthers = true;
    return null;
  };

  /*
   * Get a sanpshot of current board state
   */
  this.getSnapshot = function() {
    var result = {gameString: self.initGameString};
    self.forAllCells(function(i, j, cell) {
      var state = cell.getState();
      result[cell.key] = JSON.stringify(state);
    });
    return result;
  };
};

/* At any time, the application can be in one of the three modes:
 *
 * 1. The user is playing a puzzle (playmode),
 * 2. The user is inputing  a puzzle manually (edit mode) or
 * 3. The user is choosing puzzle from a list of predefined puzzles.
 *
 * Echo mode should has a start and stop methods.
 *
 * The start method will be called, when the application will switch
 * to one mode. The start should initialize the state of this mode and
 * setup UI controls for the functionalities of the mode. It should
 * accept one argument state, which can be used to initialize the
 * state.
 *
 * The stop method is called when the application is going to leave
 * one mode, it should clean up/backup the state as needed, and more
 * importantly, remove all controls it has added the the UI, so the
 * next mode could use the UI.
 *
 */

/*
 * PlayModeViewModel manages the board, and the interaction between
 * the board and other control elements.
 */

var PlayModeViewModel = function(board) {
  var self = this;
  self.name = 'Play';
  this.board = board;

  // to be able to save/restore game
  this.oldGameState = {};
  this.oldStatus = false;

  // whether the play controls are activated
  this.playing = ko.observable(false);

  // 9 buttons showing 1-9, used to show missing numbers in a selected
  // set of cells, or choose which number to highligh.
  this.controlButtons = (function() {
    var result = [];
    for (var i=0; i<9; i++) {
      result.push({value: i+1,
                   enabled: ko.observable(false)});
    }
    return result;
  })();

  /*
   * Highlight missing numbers
   */
  this.highlightMissing = function(missing) {
    // set all buttons unhighlighted
    for (var i=0; i<9; i++)
      self.controlButtons[i].enabled(false);
    // if needed, highlight missing numbers
    if (missing) {
      for (i=0; i<9; i++) {
        if (missing[i]) {
          self.controlButtons[i].enabled(true);
        }
      }
    }
  };

  ////////////////////////////////////////////////
  // managing game state. new/save/restore a game.
  ////////////////////////////////////////////////
  this.saveGame = function() {
    self.oldGameState = self.board.getSnapshot();
    self.oldStatus = self.playing();
  };

  /*
   * Restore game to a given state.
   */
  this.restoreGame = function() {
    self.board.setBoardState(self.oldGameState);
    self.playing(self.oldStatus);
  };

  /*
   * Reset game to start state.
   */
  this.restartGame = function() {
    self.board.reset();
    self.submitStatus();
  };

  /*
   * Submit current status to hangout server
   */
  this.submitStatus = function() {
    var snapshot = self.board.getSnapshot();
    snapshot.mode = 'Play';
    HANGOUTAPI.submitDelta(snapshot);
  };

  /*
   * Highlighting units (row, col, square or value) and showing
   * missing values
   */
  this.highlightUnit = function(unit, notify) {
    var missing = self.board.highlightUnit(unit);
    self.highlightMissing(missing);

    if (notify) {
      HANGOUTAPI.sendMessage(unit);
    }
  };

  this.gestureDetector = new SelectionGesture();
  /*
   * The parameter for the start function may have two different format:
   * 1. It has 'restore' property, so playmode will restore a saved puzzle
   * 2. It has 'gameString' property, so it represents the state of a puzzle,
   *    playmode will use the state to initialize itself.
   */
  this.start = function(arg, notify) {
    if (arg.restore) {
      self.restoreGame();
    } else {
      var gameString = arg.gameString;
      if (gameString) {
        self.board.setBoardState(arg);
      }
      self.playing(true);
    }
    if (self.playing()) {
      self.setupControls();
    }
    if (notify) {
      self.submitStatus();
    }
  };

  /*
   * Add UI event handlers for play mode.
   */
  this.setupControls = function() {
    /*
     * clicking on a cell will highlight all its peers
     */
    $('#game-pane').on('click', '.cell', function() {
      var data = ko.dataFor(this);
      self.highlightUnit({type: 'cell', row: data.i, col: data.j}, true);
    });

    /*
     * When focusing on a cell, typing digits (1-9) will add/remove that
     * value to the cell and '0' means remove all value
     */
    $('#game-pane').on('keydown', '.cell', function(e) {
      var key = e.which;
      var data = ko.dataFor(this);
      if (key < 48 || key > 57) return;
      self.board.removeOrAddValue(data.i, data.j, ''+(key-48));
    });

    $('#game-pane').on('click', 'td.top-cell', function() {
      var context = ko.contextFor(this);
      self.highlightUnit({type: 'col', col: context.$index()}, true);
    });
    $('#game-pane').on('click', 'td.side-cell', function() {
      var context = ko.contextFor(this);
      self.highlightUnit({type: 'row', row: context.$index()}, true);
    });

    /*
     * When mouse button is down, start tracking the cells that the mouse passed
     */
    $('#game-pane').on('mousedown', '.cell', function(e) {
      var cell = ko.dataFor(this);
      self.gestureDetector.startGesture(cell);
    });

    /*
     * When the cursor enters a cell, record it
     */
    $('#game-pane').on('mouseenter', '.cell', function(e) {
      var cell = ko.dataFor(this);
      var msg = {key: 'pointer', row:cell.i, col: cell.j};
      self.gestureDetector.addCell(cell);
    });

    /*
     * When mouse button is up, try to guess the type and highlight it.
     */
    $('body').on('mouseup', function(e) {
      var type = self.gestureDetector.endGesture();
      if (type) {
        self.highlightUnit(type, true);
      }
    });
    /*
     * When the control buttons are clicked, highlight coresponding values
     */
    $('.digit-button').on('click', function(e) {
      var target = e.target;
      var data = ko.dataFor(target);
      if (self.board.focusedCell) {
        var i = self.board.focusedCell.i;
        var j = self.board.focusedCell.j;
        self.board.removeOrAddValue(i, j, data.value);
      } else {
        self.highlightUnit({value: data.value, type: 'value'}, true);
      }
    });
    /*
     * clicking outside the game pane will remove all highlights
     */
    $('body').on('click', function(e) {
      var target = e.target;
      var s = $(target).parents('table').size();
      if ( s == 0) {
        self.highlightUnit({type: 'null'}, true);
      }
    });
  };

  this.stop = function() {
    if (self.playing()) {
      $('body').off('click');
      $('#game-pane').off();
      $('body').off('mouseup');
      $('.digit-button').off('click');
      self.playing(false);
    }
  };
};

/*
 * There are two ways to get a new puzzle: choose a predefined game
 * from a list or edit the game board cell by cell.
 *
 * The two ways are implemented in two ViewModels.
 */
var PuzzleListViewModel = function(board) {
  var self = this;
  self.name = 'List';
  this.board = board;
  this.puzzleID = ko.observable(1);
  this.notify = true;

  this.updateBoard = function(newValue) {
    self.board.setBoardState({gameString: self.puzzleList[newValue-1] || ''});
    if (self.notify) {
      window.HANGOUTAPI.submitDelta({mode: 'List', puzzleID: ''+self.puzzleID()});
    }
  };

  self.puzzleID.subscribe(self.updateBoard);

  this.start = function(state, notify) {
    var pid = state && state['puzzleID'];
    if (pid == undefined) {
      pid = self.puzzleID();
    }
    self.notify = notify;
    if (pid == self.puzzleID()) {
      self.updateBoard(pid);
    } else {
      self.puzzleID(pid);
    }
  };

  this.stop = function() {
  };

  this.addPuzzles = function(puzzles) {
    self.puzzleList.push.apply(puzzles);
  };

  this.getGame = function() {
    return self.puzzleList[self.puzzleID()-1];
  };
  this.puzzleList = ['003020600900305001001806400008102900700000008006708200002609500800203009005010300',
                     '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
                     '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
                     '030050040008010500460000012070502080000603000040109030250000098001020600080060020',
                     '020810740700003100090002805009040087400208003160030200302700060005600008076051090',
                     '100920000524010000000000070050008102000000000402700090060000000000030945000071006',
                     '043080250600000000000001094900004070000608000010200003820500000000000005034090710',
                     '480006902002008001900370060840010200003704100001060049020085007700900600609200018',
                     '000900002050123400030000160908000000070000090000000205091000050007439020400007000',
                     '001900003900700160030005007050000009004302600200000070600100030042007006500006800',
                     '000125400008400000420800000030000095060902010510000060000003049000007200001298000',
                     '062340750100005600570000040000094800400000006005830000030000091006400007059083260',
                     '300000000005009000200504000020000700160000058704310600000890100000067080000005437',
                     '630000000000500008005674000000020000003401020000000345000007004080300902947100080',
                     '000020040008035000000070602031046970200000000000501203049000730000000010800004000',
                     '361025900080960010400000057008000471000603000259000800740000005020018060005470329',
                     '050807020600010090702540006070020301504000908103080070900076205060090003080103040',
                     '080005000000003457000070809060400903007010500408007020901020000842300000000100080',
                     '003502900000040000106000305900251008070408030800763001308000104000020000005104800',
                     '000000000009805100051907420290401065000000000140508093026709580005103600000000000',
                     '020030090000907000900208005004806500607000208003102900800605007000309000030020050',
                     '005000006070009020000500107804150000000803000000092805907006000030400010200000600',
                     '040000050001943600009000300600050002103000506800020007005000200002436700030000040',
                     '004000000000030002390700080400009001209801307600200008010008053900040000000000800',
                     '360020089000361000000000000803000602400603007607000108000000000000418000970030014',
                     '500400060009000800640020000000001008208000501700500000000090084003000600060003002',
                     '007256400400000005010030060000508000008060200000107000030070090200000004006312700',
                     '000000000079050180800000007007306800450708096003502700700000005016030420000000000',
                     '030000080009000500007509200700105008020090030900402001004207100002000800070000090',
                     '200170603050000100000006079000040700000801000009050000310400000005000060906037002',
                     '000000080800701040040020030374000900000030000005000321010060050050802006080000000',
                     '000000085000210009960080100500800016000000000890006007009070052300054000480000000',
                     '608070502050608070002000300500090006040302050800050003005000200010704090409060701',
                     '050010040107000602000905000208030501040070020901080406000401000304000709020060010',
                     '053000790009753400100000002090080010000907000080030070500000003007641200061000940',
                     '006080300049070250000405000600317004007000800100826009000702000075040190003090600',
                     '005080700700204005320000084060105040008000500070803010450000091600508007003010600',
                     '000900800128006400070800060800430007500000009600079008090004010003600284001007000',
                     '000080000270000054095000810009806400020403060006905100017000620460000038000090000',
                     '000602000400050001085010620038206710000000000019407350026040530900020007000809000',
                     '000900002050123400030000160908000000070000090000000205091000050007439020400007000',
                     '380000000000400785009020300060090000800302009000040070001070500495006000000000092',
                     '000158000002060800030000040027030510000000000046080790050000080004070100000325000',
                     '010500200900001000002008030500030007008000500600080004040100700000700006003004050',
                     '080000040000469000400000007005904600070608030008502100900000005000781000060000010',
                     '904200007010000000000706500000800090020904060040002000001607000000000030300005702',
                     '000700800006000031040002000024070000010030080000060290000800070860000500002006000',
                     '001007090590080001030000080000005800050060020004100000080000030100020079020700400',
                     '000003017015009008060000000100007000009000200000500004000000020500600340340200000',
                     '300200000000107000706030500070009080900020004010800050009040301000702000000008006',
                     '.58...41.7..4.5..32...1...99...4...2.7.....3..6.....5...1...8.....2.7.......5....'];
};

var GameEditorViewModel = function(board) {
  var self = this;
  var emptyGame = ('.........\n.........\n.........\n.........\n.........\n' +
                   '.........\n.........\n.........\n.........');
  this.board = board;
  this.editedGameString = ko.observable('');
  this.updateCells = true;
  this.name = 'Edit';
  this.editing = false;

  function normalizeGameString(gameString) {
    gameString = gameString.replace(/[^1-9\s]/g, '.');
    return gameString.replace(/\s/g, '');
  };

  /*
   * Fill the board with given gameString, the gameString may have
   * more or less than 81 valid values.
   */
  this.setGame = function(gameString) {
    gameString = normalizeGameString(gameString);
    if (self.updateCells) {
      self.board.setBoardState({gameString: gameString});
    }
    if (self.notify) {
      HANGOUTAPI.submitDelta({editorGameString: gameString, mode: 'Edit'});
    }
  };

  this.editedGameString.subscribe(self.setGame);
  /*
   * set up actions for interactive editing of the game.
   */
  this.start = function(arg, notify) {
    self.notify = notify;
    self.editedGameString(arg.gameString || emptyGame);
    if (self.editing) return;  // already in edit mode, don't need to setup the controls

    // set up the controls
    self.editing = true;
    $('#game-pane').on('click', '.cell', function(e) {
      var cell = ko.dataFor(this);
      if (self.oldFocused) {
        self.oldFocused.isFocused(false);
      }
      cell.isFocused(true);
      self.oldFocused = cell;
    });
    $('#game-pane').on('keydown', '.cell', function(e) {
      var cell = ko.dataFor(this);
      var key = e.which;
      if (key < 48 || key > 57) return;

      // assign the value to the cell
      key = ''+ (key-48);
      if (cell.getValue() == key) return;
      cell.init(key);

      // update the editedGameString, but don't need to update the cells
      self.updateCells = false;
      self.editedGameString(self.board.gameStringFromCells());
    });
  };

  /*
   * remove registered event listeners.
   */
  this.stop = function() {
    $('#game-pane').off();
    self.editedGameString('');
    self.editing = false;
  };

  /*
   * get the edited game string
   */
  this.getGame = function() {
    return normalizeGameString(self.editedGameString());
  };
};

/*
 * Manage the mode of the game: play, editor and puzzle chooser.
 */
var SudokuGameViewModel = function() {
  var self = this;
  // components of the game state
  this.board = new BoardViewModel(9, 9);
  this.playMode = new PlayModeViewModel(this.board);
  this.gameEditor = new GameEditorViewModel(this.board);
  this.puzzleChooser = new PuzzleListViewModel(this.board);
  this.users = new UserList();

  this.mode = ko.observable(self.playMode);
  this.modes = {
    'Play': self.playMode,
    'List': self.puzzleChooser,
    'Edit': self.gameEditor
  };

  this.strings = ko.observable(strings['en']);

  /*
   * Switch to given mode: first stop current mode, then start the new
   * mode.
   */
  this.switchToMode = function(mode, args, notify) {
    self.mode().stop();
    self.mode(mode);
    mode.start(args, notify);
  };

  this.switchToModeByName = function(modename, args, notify) {
    self.switchToMode(self.modes[modename], args, notify);
  };

  /*
   * Stop choosing/editing new puzzle, go back to old puzzle.
   */
  this.cancelEdit = function() {
    self.switchToMode(self.playMode, {restore: true}, true);
  };

  /*
   * Get the new gameString from game selecting mode, then initialize
   * the game.
   */
  this.startNewGame = function() {
    var newGameString = self.mode().getGame();
    self.switchToMode(self.playMode, {gameString: newGameString}, true);
  };

  /*
   * The methods of choosing new puzzle
   */
  this.getNewGame = function(method, notify) {
    self.playMode.saveGame();
    self.switchToMode(method, {}, true);
  };

  $(document).on('done', function(e, p) {
    if (p) {
      alert('完成了, 祝贺你.');
    }
    return false;
  });

  /*
   * set the game board, according to the shared state
   */
  this.catchUp = function(state) {
    console.log("Switching to mode:", state.mode);
    self.switchToMode(self.modes[state.mode], state, false);
  };

  this.newGameMethods = [self.gameEditor, self.puzzleChooser];

  this.getBackground = function(userId) {
    return self.users.getBackground(userId);
  };

  $('#new-game-menu').on('click', 'li.new-game', function(e) {
    e.stopPropagation();
    var data = ko.dataFor(this);
    self.getNewGame(data, true);
  });
};

/*
 * Support simple gestures of selecting row, col or unit.
 *
 * When dragging through multiple cells, if all the cells that the
 * mouse had moved over are in the same row, col or unti, then
 * highlight that row, col or unit.
 */
var SelectionGesture = function() {
  var self = this;

  // keep tracking the cells that the mouse has moved over
  self.cellsOnPath = [];
  self.dragging = false;

  /*
   * Take an array of cells the gesture has passed, guess the user's
   * intention, there should be at least two cells in the array:
   *
   * 1. If all cells are in the same row, return {type: 'row', row: row}

   * 2. If all cells are in the same column, return {type: 'column', col:
   * col}

   * 3. Otherwise, if all cells are in the * square, return {type:
   * 'square',row: r, col: c}.

   * 4. Otherwise, return null;
   */
  function shapeDetect(cells) {
    if (cells.length < 2) {
      return null;
    }
    var cell = cells[0];
    var currentRow = cell.i,
        currentCol = cell.j,
        currentSquare = {row: Math.floor(cell.i/3),
                         col:Math.floor(cell.j/3)};
    var isRow = true, isCol = true, isSquare = true;
    for (var i=0; i<cells.length; i++) {
      cell = cells[i];
      isRow = isRow && (currentRow == cell.i);
      isCol = isCol && (currentCol == cell.j);
      isSquare = isSquare && (currentSquare.row == Math.floor(cell.i/3) &&
                              currentSquare.col == Math.floor(cell.j/3));
    }
    if (isRow) {
      return {type: 'row', row: currentRow};
    } else if (isCol) {
      return {type: 'col', col: currentCol};
    } else if (isSquare) {
      return {type: 'square', row: currentSquare.row, col: currentSquare.col};
    } else {
      return null;
    }
  };

  this.startGesture = function startGesture(cell) {
    self.dragging = true;
    self.cellsOnPath.splice(0, self.cellsOnPath.length, cell);
  };

  this.addCell = function addCell(cell) {
    // add an element to the array unless the element is already in it
    if (self.dragging && self.cellsOnPath.indexOf(cell) == -1) {
      self.cellsOnPath.push(cell);
    }
  };

  this.endGesture = function endGesture() {
    if (!self.dragging) return null;
    self.dragging = false;
    return shapeDetect(self.cellsOnPath);
  };
};

var sudoku = new SudokuGameViewModel();

if (window.gapi && gapi.hangout && gapi.hangout.onApiReady) {
  var hangout = gapi.hangout;
  hangout.onApiReady.add(function() {
    // redefine the HANGOUTAPI functions, using real hangout api
    window.HANGOUTAPI = {
      clearValue: function(key){},
      setValue: function(key, value) {
        hangout.data.setValue(key, JSON.stringify(value));
      },
      submitDelta: function(opt_updates, opt_removes) {
        hangout.data.submitDelta(opt_updates, opt_removes);
      },
      sendMessage: function(message) {
        hangout.data.sendMessage(JSON.stringify(message));
      }
    };

    var locale = hangout.getLocalParticipantLocale();
    console.log(locale);
    sudoku.strings(strings[locale] || strings['en']);

    // catch up with the group:
    // get current user list and current state
    sudoku.users.localUser(hangout.getLocalParticipantId());
    sudoku.users.addUsers(hangout.getParticipants());
    sudoku.board.setLocalUser(hangout.getLocalParticipantId());

    var state = hangout.data.getState();
    if (state.mode) {
      sudoku.catchUp(state);
    }


    hangout.onParticipantsEnabled.add(function(event) {
      var newUsers = event.enabledParticipants;
      sudoku.users.addUsers(newUsers);
    });
    hangout.onParticipantsDisabled.add(function(event) {
      var leaved = event.disabledParticipants;
      sudoku.users.removeUsers(leaved);
    });
    /*
     * Handle received messages. There is only one kind of messages:
     * Highlighting commands.
     *
     * {type: 'row', row: 1, col: 1},
     *     where type can be 'row', 'col', 'cell', 'square', 'value'
     */
    hangout.data.onMessageReceived.add(function(event) {
      var sender = event.senderId;
      // ignore the message if it's send by local user or the sender
      if (sender == sudoku.users.localUser() ||
          !sudoku.users.enabled(sender))
        return;
      var message = JSON.parse(event.message);
      sudoku.board.highlightUnit(message, false);
    });

    /*
     * Handle state change event. Sudoku state has the following properties:
     *
     {
     mode: 'play', // can be 'edit', 'list'
     gameString: '0102', // used 'play' mode
     c0#0: [],  // used in play mode
     c0#1: [1,2],
     ...
     c8#8: [9]
     puzzleID: 12  // used in 'list' mode
     editorGameString: '120...' //used in 'edit' mode
     }
     *
     */
    hangout.data.onStateChanged.add(function(event) {
      var changedKeys = event.addedKeys;
      var mode = event.state['mode'];
      var owner;
      var localUser = sudoku.users.localUser();

      switch (mode) {
      case 'List':
        // current mode is 'List', we only need to update the puzzleID
        var pid = event.state['puzzleID'];
        owner = event.metadata['puzzleID'].lastWriter;
        if (owner != localUser) {
          sudoku.switchToModeByName('List', {puzzleID: pid}, true);
        }
        break;
      case 'Edit':
        // current mode is 'Edit', just update the editedGameString
        var editorGameString = event.state['editorGameString'];
        owner = event.metadata['editorGameString'].lastWriter;
        if (owner != localUser) {
          sudoku.switchToModeByName('Edit', {gameString: editorGameString}, false);
        }
        break;
      case 'Play':
        // when the mode is 'Play', it is complicated. There are several
        // different ways to change the state:
        // 1. Just switched to 'Play' mode, (if 'mode' is in changedKeys)
        // 2. already in 'Play' mode, only the values of some cell is
        // changed ('mode' will not in changedKeys)

        // first, check if 'mode' is in changedKeys
        var modeChange = false;
        for (var i=0; i<changedKeys.length; ++i) {
          if (changedKeys[i].key == 'mode') {
            modeChange = true;
            owner = changedKeys[i].lastWriter;
            break;
          }
        }
        if (modeChange && owner != localUser) {
          // we can pass the event.state directly to PlayModeViewModel's
          // start method
          sudoku.switchToModeByName('Play', event.state, false);
        } else {
          // update the cells mentioned in changedKeys
          for (i=0; i<changedKeys.length; i++) {
            var cellName = changedKeys[i].key;
            var cellState = changedKeys[i].value;
            owner = cellState.owner;
            if (cellName[0] != 'C') {
              continue;
            }
            var row = parseInt(cellName[1]);
            var col = parseInt(cellName[3]);
            var cellValues = JSON.parse(cellState.value);
            //            if (lastWriter == localUser) continue;
            sudoku.board.updateCell(row, col, cellValues, owner);
          }
        }
      }
    });
  });
}

ko.applyBindings(sudoku);
sudoku.board.setBoardState({gameString: '.58...41.7..4.5..32...1...99...4...2.7.....3..6.....5...1...8.....2.7.......5....'});
