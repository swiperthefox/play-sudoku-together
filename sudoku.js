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
  clearValue: function(key){},
  setValue: function(key, value){console.log("set value:", key + ':' + value);},
  submitDelta: function(opt_updates, opt_removes){console.log("Delta:", opt_updates);},
  sendMessage: function(message){console.log("message:", message);}
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
 * c0#0, c0#1, ..., c8#8: (Cell.removeOrAddValue) The value list of each cell.
 *
 * gameString: (BoardViewModel.setBoardState)the game string of the board.
 *
 * puzzleID: (PuzzleListViewModel.updateBoard) the id of current selected puzzle,
 *
 * owner: (SudokuGameViewModel.switchToMode) Operations to
 * create/choose new game can only performed by one player (called
 * owner) and others can only discuss with the owner. The first user
 * started such actions is the owner, and the owner is set to "" when
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
  self.name = name;
  self.id = id;
  self.follow = ko.observable(follow);
  self.toggleState = function() {
    self.follow(!self.follow());
  };
};

/*
 * User list, mapping a user id to color setting
 */
var UserList = function() {
  var self = this;
  self.userList = ko.observableArray();
  self.userMap = Object.create(null);
  self.localUser = ko.observable("");

  self.addUser = function(id, name) {
    console.log(self.localUser(), ',', id);
    if (id != self.localUser() && !self.userMap[id]) {
      console.log("id=", id);
      console.log("local User =", self.localUser());
      var newUser = new User(id, name, false);
      self.userList.push(newUser);
      self.userMap[id] = newUser;
    };
  };

  self.addUsers = function(ulist) {
    for (var i=0; i<ulist.length; ++i) {
      var user = ulist[i];
      self.addUser(user.id, user.person.displayName);
    }
  };

  self.removeUser = function (id) {
    delete self.userMap[id];
    var users = self.userList();
    for (var i=0; i<users.length; ++i) {
      var user = users[i];
      if (user.id == id) {
        self.userList.splice(i, 1);
        return;
      }
    }
  };

  self.removeUsers = function(ulist) {
    for (var i=0; i<ulist.length; ++i) {
      self.removeUser(ulist[i].id);
    }
  };

  self.toggleState = function(uid) {
    self.userMap[uid].toggleState();
  };

  self.enabled = function(uid) {
    return self.userMap[uid].follow();
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

palette.dimmedColors = (function(mask) {
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

    var result = 'rgb(' + r + ',' + g + ',' + b + ')';
    return result;
  }

  var nc = palette.normalColor;
  return {
    'pointer': maskedColor(nc['pointer'], mask),
    'focused': maskedColor(nc['focused'], mask),
    'peerHLD': maskedColor(nc['peerHLD'], mask),
    'white': maskedColor(nc['white'], mask)
    };
})('#dddddd');

/*
 * Represents the infomation in one cell.
 */
var CellState = function(i, j) {
  var self = this;
  // position
  self.i = i;
  self.j = j;
  // assigned values
  self.values = ko.observableArray();

  // bookkeeping variables for highlighting, currectness check
  self.isGiven = ko.observable(false);         // whether this cell is given at the start
  self.conflictCount = ko.observable(0);       // conflict with how many other cells
  self.peerHighlight = ko.observable(false);
  self.isFocused = ko.observable(false);       // is it the cell that accepting input
  self.valueHighlight = ko.observable(false);
  self.pointerHighlight = ko.observable(false);
  self.isNotMarker = ko.computed(function() {
    return self.values().length == 1;
  }, this);
  self.key = 'C' + i + '#' + j;       // used to encode the game state

  // colors used for the background of different kind of cells
  self.colors = ko.computed(function() {
    return self.isGiven()? palette.dimmedColors :palette.normalColor;
  }, this);

  /*
   * background of the cell has the following possible values, from lowest priority:
   * 1. normal color: white
   * 2. given cell: #dddddd
   * 3. highlighted cell
   * 4. focused cell: input will go into this cell
   * 5. pointer: mouse is pointing to this cell
   */
  self.background = ko.computed(function() {
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
  self.color = ko.computed(function() {
    return ((self.conflictCount() > 0 && "#ff0000") ||
            (self.valueHighlight()    && "#0000ff") ||
            (true                     && "#000000"));
  }, this);

  // border classes to draw wider borders for square units
  self.borderClass = (function() {
    var leftBorder = (j%3 == 0);
    var rightBorder = (j+1)%3==0;
    var topBorder = (i%3 == 0);
    var bottomBorder = ((i+1)%3==0);
    var result = "cell";
    if (leftBorder) result += " cell-left-border";
    if (rightBorder) result += " cell-right-border";
    if (bottomBorder) result += " cell-bottom-border";
    if (topBorder) result += " cell-top-border";
    return result;
  })();


  /*
   * stringValue: combine the values into a single string,
   * to be shown in the cell.
   */
  self.stringValue = ko.computed(function() {
    return self.values().join(' ');
  });


  self.setValue = function(values) {
    self.values.removeAll();
    self.values.push.apply(self.values, values);
  };
  /*
   * Set the state of cell
   *
   * values is an array of values, and isGiven is a bool.
   */
  self.setState = function(values, isGiven) {
    self.setValue(values);
    self.isGiven(isGiven);
    self.conflictCount(0);
    self.peerHighlight(false);
    self.isFocused(false);
    self.valueHighlight(false);
  };

  self.init = function(initValue, currentValues) {
    var isGiven = initValue != undefined  && initValue >= '1' && initValue <= '9';
    var givenValue = isGiven?[initValue]:[];
    currentValues = currentValues || givenValue;
    self.setState(currentValues, isGiven);
  };

  /*
   * Get the first value from the value list.
   */
  self.getValue = function() {
    return self.values()[0];
  };

  /*
   * remove or add value v to the cells value list
   * 1. if v is '0', clear all values
   * 2. if v in values, remove it.
   * 3. Otherwise, add v to values.
   *
   * Since changing the value list of the cell may cause new
   * conflictions with other cells, or some old conflictions may be
   * resolved, this function will return an object {value: v, delta:
   * i}, where v is the value may involved in conflictions, and delta
   * represents how conflictions will change (create new confliction
   * or resolve old ones).
   *
   * Using the returned value, the caller can perform further checks
   * for conflictions.
   */
  self.removeOrAddValue = function(v) {
    if (self.isGiven()) return null;
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
      result = self.updateValue(values);
    }
    HANGOUTAPI.setValue(self.key, self.values());
    return result;
  };

  self.updateValue = function(values) {
    var conflictPotential = {};
    if (values.length == 1) {
      conflictPotential['new'] = values[0];
    }
    if (self.values().length == 1) {
      conflictPotential['old'] = self.getValue();
    }
    self.setValue(values);
    return conflictPotential;
  };
};

/*
 * BoardViewModel manages a game board, which consists 9x9 cells.
 */

var BoardViewModel = function(row, col) {
  var self = this;

  // board dimensions
  self.row = row;
  self.col = col;
  // row x col CellState objects in an rowxcol grid
  self.cells = (function() {
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

  self.done = ko.observable(false);
  self.done.subscribe(function(value) {
    $(document).trigger('done', [value]);
  });
  self.initGameString = "";

  /*
   * forAllCells: apply a function to all cells in the board.
   *
   * f is a function that accepts (i, j, cell).
   */
  self.forAllCells = function(f) {
    var rowCount = self.cells.length;
    for (var i=0; i<rowCount; ++i) {
      var row = self.cells[i];
      var colCount = row.length;
      for (var j=0; j<colCount; ++j) {
        f(i, j, row[j]);
      }
    }
  };

  /*
   * set game board state, given a string representation of a sudoku
   * game, optionally with an object whose keys in the form like
   * "ci#j", where i, j are digits from 1 to 9, representing the
   * current values filled in cell(i, j).
   */
  self.setBoardState = function(gameState) {
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

  self.reset = function() {
    self.setBoardState({gameString: self.initGameString});

  };

  self.gameStringFromCells = function() {
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
  self.afterChangeCell = function(i, j, conflictPotential) {
    if (conflictPotential != null) {
      self.conflictCheck(i, j, conflictPotential);
    }
    if (self.cells[i][j].isNotMarker()) {
      self.highlightByValue({value: self.cells[i][j].getValue()});
    }
  };

  /*
   * Add a value v to a given cell(i, j). If this may cause the number
   * of confliction change, check the conflicts again.
   */
  self.removeOrAddValue = function(i, j, v) {
    var conflictPotential = self.cells[i][j].removeOrAddValue(v);
    self.afterChangeCell(i, j, conflictPotential);
  };

  /*
   * Set the value of given cell
   */
  self.updateCell = function(i, j, values) {
    var conflictPotential = self.cells[i][j].updateValue(values);
    self.afterChangeCell(i, j, conflictPotential);
  };
  /*
   * Test if two given cells are peers in rows, columns or squrares
   */
  self.isPeer = function(i1, j1, i2, j2) {
    return  ((i1 != i2 || j1 != j2) && // not the same cell AND
             (i1 == i2 || // same row OR
              j1 == j2 || // same column OR
              (Math.floor(i1/3)==Math.floor(i2/3) &&
               Math.floor(j1/3)==Math.floor(j2/3))));  // same square
  };

  /*
   * Check confliction between cell(row, col) and all other cells,
   * assuming cell(row, col) has value v.
   *
   * If any other cell also has the value v, increase that cell's
   * conflictCount by delta. (delta may be -1, which means an
   * confliction caused by v is resolved).
   */
  self.conflictCheck = function(row, col, conflict) {
    var newValue = conflict['new'];
    var oldValue = conflict['old'];

    var filled = 0;
    var confict = 0;
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
      confict += cell.conflictCount();
    }, false);
    self.done(filled == 81 && confict == 0);
  };

  self.withOthers = true;
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
  self.highlightCells = function(f, withOthers) {
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
        };
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
  self.highlightRow = function(row) {
    return self.highlightCells(function(i, j) {return i==row;}, true);
  };

  self.highlightCol = function(col) {
    return self.highlightCells(function(i, j) {return j==col;}, true);
  };

  self.highlightSquare = function(row, col) {
    return self.highlightCells(function(i, j) {
      return Math.floor(j/3)==col && Math.floor(i/3)==row;
    }, false);
  };

  self.selectCell = function(row, col) {
    var missing = self.highlightCells(function(i, j) {
      return self.isPeer(i, j, row, col);
    }, false);
    self.cells[row][col].isFocused(true);
    // if the cell contains given value, no need to show missing values
    if (self.cells[row][col].isGiven()) {
      missing = [];
    }
    return missing;
  };

  /*
   * Highlight all cells that is assigned value v.
   */
  self.highlightByValue = function(v) {
    self.forAllCells(function(i, j, cell) {
      var highlight = cell.isNotMarker() && cell.getValue() == v;
      cell.valueHighlight(highlight);
    });
    return null;
  };

  /*
   * Highlight cells, accepts an object that has the following format:
   * { shape: "row", // can be "row", "col", "square", "cell", "value"
   *   row: 4,
   *   col: 5,
   *   value: 4     // only used when shape is "value"
   * }
   */
  self.highlightUnit = function(unit) {
    var missing;
    switch (unit.shape) {
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
  self.setPointer = function(row, col) {
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
  self.removeHighlights = function() {
    self.highlightCells(function(i,j) {return false;}, false);
    self.highlightByValue({value: null});
    if (self.previousPointerRow != undefined) {
      self.cells[self.previousPointerRow][self.previousPointerCol].pointerHighlight(false);
      self.previousPointerCol = undefined;
      self.previousPointerRow = undefined;
    }
    self.withOthes = true;
    return null;
  };

  /*
   * Get a sanpshot of current board state
   */
  self.getSnapshot = function() {
    var result = {gameString: self.initGameString};
    self.forAllCells(function(i, j, cell) {
      result[cell.key] = JSON.stringify(cell.values().slice(0));
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
  self.board = board;

  // to be able to save/restore game
  self.oldGameState = {};
  self.oldStatus = false;

  // whether the play controls are activated
  self.playing = ko.observable(false);

  // 9 buttons showing 1-9, used to show missing numbers in a selected
  // set of cells, or choose which number to highligh.
  self.controlButtons = (function() {
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
  self.highlightMissing = function(missing) {
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
  self.saveGame = function() {
    self.oldGameState = self.board.getSnapshot();
    self.oldStatus = self.playing();
  };

  /*
   * Restore game to a given state.
   */
  self.restoreGame = function() {
    self.board.setBoardState(self.oldGameState);
    self.playing(self.oldStatus);
  };

  /*
   * Reset game to start state.
   */
  self.restartGame = function() {
    self.board.reset();
    self.submitStatus();
  };

  /*
   * Submit current status to hangout server
   */
  self.submitStatus = function() {
    var snapshot = self.board.getSnapshot();
    snapshot.mode = "Play";
    HANGOUTAPI.submitDelta(snapshot);
  };

  /*
   * Highlighting units (row, col, square or value) and showing
   * missing values
   */
  self.highlightUnit = function(unit, notify) {
    var missing = self.board.highlightUnit(unit);
    self.highlightMissing(missing);

    if (notify) {
      HANGOUTAPI.sendMessage(unit);
    }
  };

  self.gestureDetector = new SelectionGesture();
  /*
   * The parameter for the start function may have two different format:
   * 1. It has 'restore' property, so playmode will restore a saved puzzle
   * 2. It has 'gameString' property, so it represents the state of a puzzle,
   *    playmode will use the state to initialize itself.
   */
  self.start = function(arg, notify) {
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
  self.setupControls = function() {
    /*
     * clicking on a cell will highlight all its peers
     */
    $('#game-pane').on('click', '.cell', function() {
      var data = ko.dataFor(this);
      self.highlightUnit({shape: 'cell', row: data.i, col: data.j}, true);
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
      self.highlightUnit({shape: 'col', col: context.$index()}, true);
    });
    $('#game-pane').on('click', 'td.side-cell', function() {
      var context = ko.contextFor(this);
      self.highlightUnit({shape: 'row', row: context.$index()}, true);
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
      var shape = self.gestureDetector.endGesture();
      if (shape) {
        self.highlightUnit(shape, true);
      }
    });
    /*
     * When the control buttons are clicked, highlight coresponding values
     */
    $('.digit-button').on('click', function(e) {
      var target = e.target;
      var data = ko.dataFor(target);
      self.highlightUnit({value: data.value, shape: 'value'}, true);
    });
    /*
     * clicking outside the game pane will remove all highlights
     */
    $('body').on('click', function(e) {
      var target = e.target;
      var s = $(target).parents('table').size();
      if ( s == 0) {
        self.highlightUnit({shape: "null"}, true);
      }
    });
  };

  self.stop = function() {
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
var PuzzleListViewModel = function (board) {
  var self = this;
  self.name = "List";
  self.board = board;
  self.puzzleID = ko.observable(1);
  self.notify = true;

  self.updateBoard = function(newValue) {
    self.board.setBoardState({gameString: self.puzzleList[newValue-1] || ""});
    if (self.notify) {
      window.HANGOUTAPI.submitDelta({mode: "List", puzzleID: ''+self.puzzleID()});
    }
  };

  self.puzzleID.subscribe(self.updateBoard);

  self.start = function(state, notify) {
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

  self.stop = function() {
  };

  self.addPuzzles = function(puzzles) {
    self.puzzleList.push.apply(puzzles);
  };


  self.getGame = function() {
    return self.puzzleList[self.puzzleID()-1];
  };
  self.puzzleList = ["003020600900305001001806400008102900700000008006708200002609500800203009005010300",
                     "200080300060070084030500209000105408000000000402706000301007040720040060004010003",
                     "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
                     "030050040008010500460000012070502080000603000040109030250000098001020600080060020",
                     "020810740700003100090002805009040087400208003160030200302700060005600008076051090",
                     "100920000524010000000000070050008102000000000402700090060000000000030945000071006",
                     "043080250600000000000001094900004070000608000010200003820500000000000005034090710",
                     "480006902002008001900370060840010200003704100001060049020085007700900600609200018",
                     "000900002050123400030000160908000000070000090000000205091000050007439020400007000",
                     "001900003900700160030005007050000009004302600200000070600100030042007006500006800",
                     "000125400008400000420800000030000095060902010510000060000003049000007200001298000",
                     "062340750100005600570000040000094800400000006005830000030000091006400007059083260",
                     "300000000005009000200504000020000700160000058704310600000890100000067080000005437",
                     "630000000000500008005674000000020000003401020000000345000007004080300902947100080",
                     "000020040008035000000070602031046970200000000000501203049000730000000010800004000",
                     "361025900080960010400000057008000471000603000259000800740000005020018060005470329",
                     "050807020600010090702540006070020301504000908103080070900076205060090003080103040",
                     "080005000000003457000070809060400903007010500408007020901020000842300000000100080",
                     "003502900000040000106000305900251008070408030800763001308000104000020000005104800",
                     "000000000009805100051907420290401065000000000140508093026709580005103600000000000",
                     "020030090000907000900208005004806500607000208003102900800605007000309000030020050",
                     "005000006070009020000500107804150000000803000000092805907006000030400010200000600",
                     "040000050001943600009000300600050002103000506800020007005000200002436700030000040",
                     "004000000000030002390700080400009001209801307600200008010008053900040000000000800",
                     "360020089000361000000000000803000602400603007607000108000000000000418000970030014",
                     "500400060009000800640020000000001008208000501700500000000090084003000600060003002",
                     "007256400400000005010030060000508000008060200000107000030070090200000004006312700",
                     "000000000079050180800000007007306800450708096003502700700000005016030420000000000",
                     "030000080009000500007509200700105008020090030900402001004207100002000800070000090",
                     "200170603050000100000006079000040700000801000009050000310400000005000060906037002",
                     "000000080800701040040020030374000900000030000005000321010060050050802006080000000",
                     "000000085000210009960080100500800016000000000890006007009070052300054000480000000",
                     "608070502050608070002000300500090006040302050800050003005000200010704090409060701",
                     "050010040107000602000905000208030501040070020901080406000401000304000709020060010",
                     "053000790009753400100000002090080010000907000080030070500000003007641200061000940",
                     "006080300049070250000405000600317004007000800100826009000702000075040190003090600",
                     "005080700700204005320000084060105040008000500070803010450000091600508007003010600",
                     "000900800128006400070800060800430007500000009600079008090004010003600284001007000",
                     "000080000270000054095000810009806400020403060006905100017000620460000038000090000",
                     "000602000400050001085010620038206710000000000019407350026040530900020007000809000",
                     "000900002050123400030000160908000000070000090000000205091000050007439020400007000",
                     "380000000000400785009020300060090000800302009000040070001070500495006000000000092",
                     "000158000002060800030000040027030510000000000046080790050000080004070100000325000",
                     "010500200900001000002008030500030007008000500600080004040100700000700006003004050",
                     "080000040000469000400000007005904600070608030008502100900000005000781000060000010",
                     "904200007010000000000706500000800090020904060040002000001607000000000030300005702",
                     "000700800006000031040002000024070000010030080000060290000800070860000500002006000",
                     "001007090590080001030000080000005800050060020004100000080000030100020079020700400",
                     "000003017015009008060000000100007000009000200000500004000000020500600340340200000",
                     "300200000000107000706030500070009080900020004010800050009040301000702000000008006",
                     ".58...41.7..4.5..32...1...99...4...2.7.....3..6.....5...1...8.....2.7.......5...."];

};



var GameEditorViewModel = function(board) {
  var self = this;
  var emptyGame =   ".........\n.........\n.........\n.........\n.........\n"
        + ".........\n.........\n.........\n.........";
  self.board = board;
  self.editedGameString = ko.observable("");
  self.updateCells = true;
  self.name = "Edit";
  self.editing = false;

  function normalizeGameString(gameString) {
    gameString = gameString.replace(/[^1-9\s]/g, '.');
    return gameString.replace(/\s/g, '');
  };

  /*
   * Fill the board with given gameString, the gameString may have
   * more or less than 81 valid values.
   */
  self.setGame = function(gameString) {
    gameString = normalizeGameString(gameString);
    if (self.updateCells) {
      self.board.setBoardState({gameString: gameString});
    }
    if (self.notify) {
      HANGOUTAPI.submitDelta({editorGameString: gameString, mode: "Edit"});
    }
  };

  self.editedGameString.subscribe(self.setGame);
  /*
   * set up actions for interactive editing of the game.
   */
  self.start = function(arg, notify) {
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
  self.stop = function() {
    $('#game-pane').off();
    self.editedGameString("");
    self.editing = false;
  };

  /*
   * get the edited game string
   */
  self.getGame = function() {
    return normalizeGameString(self.editedGameString());
  };
};

/*
 * Manage the mode of the game: play, editor and puzzle chooser.
 */
var SudokuGameViewModel = function() {
  var self = this;
  // components of the game state
  self.board = new BoardViewModel(9, 9);
  self.playMode = new PlayModeViewModel(self.board);
  self.gameEditor = new GameEditorViewModel(self.board);
  self.puzzleChooser = new PuzzleListViewModel(self.board);
  self.users = new UserList();

  self.mode = ko.observable(self.playMode);
  self.modes = {
    'Play': self.playMode,
    'List': self.puzzleChooser,
    'Edit': self.gameEditor
  };

  self.strings = ko.observable(strings['en']);
  self.strings.subscribe(function(newValue) {
    console.log(newValue);
  });

  /*
   * Switch to given mode: first stop current mode, then start the new
   * mode.
   */
  self.switchToMode = function(mode, args, notify) {
    self.mode().stop();
    self.mode(mode);
    mode.start(args, notify);
  };

  self.switchToModeByName = function(modename, args, notify) {
    self.switchToMode(self.modes[modename], args, notify);
  };

  /*
   * Stop choosing/editing new puzzle, go back to old puzzle.
   */
  self.cancelEdit = function() {
    self.switchToMode(self.playMode, {restore: true}, true);
  };

  /*
   * Get the new gameString from game selecting mode, then initialize
   * the game.
   */
  self.startNewGame = function() {
    var newGameString = self.mode().getGame();
    self.switchToMode(self.playMode, {gameString: newGameString}, true);
  };

  /*
   * The methods of choosing new puzzle
   */
  self.getNewGame = function(method, notify) {
    self.playMode.saveGame();
    self.switchToMode(method, {}, true);
  };

  $(document).on('done', function(e, p) {
    if (p) {
      alert("完成了, 祝贺你.");
    }
    return false;
  });

  /*
   * set the game board, according to the shared state
   */
  self.catchUp = function(state) {
    self.switchToMode(self.modes[state.mode], state, false);
  };

  self.newGameMethods = [self.gameEditor, self.puzzleChooser];

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
   * 1. If all cells are in the same row, return {shape: 'row', row: row}

   * 2. If all cells are in the same column, return {shape: 'column', col:
   * col}

   * 3. Otherwise, if all cells are in the * square, return {shape:
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
      return {shape: 'row', row: currentRow};
    } else if (isCol) {
      return {shape: 'col', col: currentCol};
    } else if (isSquare) {
      return {shape: 'square', row: currentSquare.row, col: currentSquare.col};
    } else {
      return null;
    }
  };

  self.startGesture = function startGesture(cell) {
    self.dragging = true;
    self.cellsOnPath.splice(0, self.cellsOnPath.length, cell);
  };

  self.addCell = function addCell(cell) {
    // add an element to the array unless the element is already in it
    if (self.dragging && self.cellsOnPath.indexOf(cell) == -1) {
      self.cellsOnPath.push(cell);
    }
  };

  self.endGesture = function endGesture() {
    if (!self.dragging) return null;
    self.dragging = false;
    return shapeDetect(self.cellsOnPath);
  };
};

var sudoku = new SudokuGameViewModel();

if (window.gapi && gapi.hangout) {
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

    var state = hangout.data.getState();
    if (state.mode) {
      sudoku.catchUp(state);
    }
  });

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
   * {shape: 'row', row: 1, col: 1},
   *     where shape can be 'row', 'col', 'cell', 'square', 'value'
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
   editorGameString: "120..." //used in "edit" mode
}
   *
   */
  hangout.data.onStateChanged.add(function(event) {
    var changedKeys = event.addedKeys;
    var mode = event.state['mode'];
    var lastWriter;
    var localUser = sudoku.users.localUser();

    switch (mode) {
    case 'List':
      // current mode is 'List', we only need to update the puzzleID
      var pid = event.state['puzzleID'];
      lastWriter = event.metadata['puzzleID'].lastWriter;
      if (lastWriter != localUser) {
        sudoku.switchToModeByName('List', {puzzleID: pid}, true);
      }
      break;
    case 'Edit':
      // current mode is 'Edit', just update the editedGameString
      var editorGameString = event.state['editorGameString'];
      lastWriter = event.metadata['editorGameString'].lastWriter;
      if (lastWriter != localUser) {
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
          lastWriter = changedKeys[i].lastWriter;
          break;
        }
      }
      if (modeChange && lastWriter != localUser) {
        // we can pass the event.state directly to PlayModeViewModel's
        // start method
        sudoku.switchToModeByName('Play', event.state, false);
      } else {
        // update the cells mentioned in changedKeys
        for (i=0; i<changedKeys.length; i++) {
          var cellName = changedKeys[i].key;
          lastWriter = changedKeys[i].lastWriter;
          if (lastWriter == localUser) continue;
          if (cellName[0] != 'C') {
            continue;
          }
          var row = parseInt(cellName[1]);
          var col = parseInt(cellName[3]);
          var cellValues = JSON.parse(changedKeys[i].value);
          sudoku.board.updateCell(row, col, cellValues);
        }
      }
    }
  });
}

ko.applyBindings(sudoku);
sudoku.board.setBoardState({gameString: ".58...41.7..4.5..32...1...99...4...2.7.....3..6.....5...1...8.....2.7.......5...."});
