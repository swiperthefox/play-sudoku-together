/*
 * call function f on each element of 2-D array arr.
 * f is a function that take (i, j, element) as arguments.
 */
function callForAll(arr, f) {
  for (var i=0; i<arr.length; i++) {
	var row = arr[i];
	for (var j=0; j<row.length; j++) {
	  f(i, j, row[j]);
	}
  }
}
var CellState = function(i, j) {
  var self = this;
  // position
  self.i = i;
  self.j = j;
  // assigned values
  self.values = ko.observableArray();
  // bookkeeping variables for highlighting, currectness check
  self.isGiven = ko.observable(false);
  self.conflictCount = ko.observable(0);
  self.highLightClass = ko.observable('');
  self.peerHighlight = ko.observable(false);
  self.isFocused = ko.observable(false);
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

  self.isNotMarker = ko.computed(function() {
    return self.values().length == 1;
  }, this);

  self.stringValue = ko.computed(function() {
    return self.values().join(' ');
  });

  /*
   *  initialization
   *
   *  v: a single character
   */
  self.init = function(v) {
    self.values.removeAll();
    var isDigit = (v && v.length==1 && '1'<=v && v<='9');
    if (isDigit) self.values.push(v);
    self.isGiven(isDigit);
    self.highLightClass('');
//    self.setNormalHighLightClass();
    self.conflictCount(0);
  };

  // self.setNormalHighLightClass = function() {
  //   //self.highLightClass(self.isGiven()?'given-cell':"");
  // };

  /*
   * add value v
   * 1. if v is '0', clear all values
   * 2. if v in values, remove it.
   * 3. Otherwise, add v to values.
   *
   * Since adding v to the cell may cause new conflictions with other
   * cells, or some old conflictions may be resolved, this function
   * will return an object {value: v, delta: i}, where v is the value
   * may involved in conflictions, and delta represents how
   * conflictions will change (create new confliction or resolve old
   * ones).
   *
   * Using the returned value, the caller can perform further checks.
   */
  self.addValue = function(v) {
    if (self.isGiven()) return null;
    if (v == '0') {
      var result = null;
      if (self.isNotMarker()) {
        // if current values is not marker, we need to remove
        // conflicts caused by the current value
        result = {value: self.values()[0], delta: -1};
      }
      self.values.removeAll();
      return result;
    } else {
      var values = self.values();
      var idx=0;
      var l;
      var original = self.values()[0];
      // find the position to insert v
      while (idx < values.length && v > values[idx]) idx++;

      if (idx<values.length && v == values[idx]) {
        // remove v
        self.values.splice(idx, 1);
        // there are three cases:
        switch (self.values().length) {
        case 0:
          // 1. [v] -> [], we need to remove conflicts caused by v
          return {value: v, delta: -1};
        case 1:
          // 2. [v1, v2] -> [v1], we need to check conflict caused by v1
          return {value: self.values()[0], delta: 1};
        default:
          // 3. l > 1, no need to check any thing
          return null;
        }
      } else {
        // add v at position idx
        self.values.splice(idx, 0, v);
        // there are three cases, depends on the length of current values:
        switch (self.values().length) {
        case 1:
          // 1. [] -> [v], we need to check conflicts caused by v
          return {value: v, delta: 1};
        case 2:
          // 2. [v1] -> [v1, v], we need to remove conflict caused by v1
          return {value: original, delta: -1};
        default:
          // 3. l > 1, no need to check any thing
          return null;
        }
      }
    };
  };

  // self.spanClass = ko.computed(function() {
  //   return this.highLightClass();// + ' ' + (this.isNotMarker()?'centered':'');
  // }, this);
};

var GameStateViewModel = function() {
  var self = this;
  self.done = ko.observable(false);
  self.gameString = ko.observable("");

  // 81 CellState objects in 9x9 array
  self.cells = (function() {
    var result = [];
    for (var i=0; i<9; i++) {
      var newRow = [];
      for (var j=0; j<9; j++) {
        newRow.push(new CellState(i, j));
      }
      result.push(newRow);
    }
    return result;
  })();

  // 9 control buttons
  self.controlButtons = (function() {
    var result = [];
    for (var i=0; i<9; i++) {
      result.push({value: i+1,
                   enabled: ko.observable(false)});
    }
    return result;
  })();

  /*
   * set state of all control buttons
   */
  self.setAllButtons = function(state) {
    for (var i=0; i<9; i++)
      self.controlButtons[i].enabled(state);
  };

  var one2nine = [1,2,3,4,5,6,7,8,9];
  function nineObservables() {
    return ko.utils.arrayMap(one2nine, ko.observable);
  }
  self.showingRow = nineObservables();
  self.showingCol = nineObservables();

  /*
   * Initialize game using a string representation of sudoku puzzle
   */
  self.setGame = function(gameString) {
    if (gameString == undefined) {
      gameString = '';
    }
    callForAll(self.cells, function(i, j, cell) {
      cell.init(gameString[i*9+j] || '');
    });
  };

  self.gameString.subscribe(self.setGame);
  self.gameString.extend({notify: 'always'});

  /*
   * Add a value v to a given cell(i, j). If this may cause the number
   * of confliction change, check the conflicts again.
   */
  self.addValue = function(i, j, v) {
    var conflictPotential = self.cells[i][j].addValue(v);
    if (conflictPotential != null) {
      self.conflictCheck(i, j, conflictPotential.value, conflictPotential.delta);
    }
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

  self.oneHighlightOnly = false;
  self.existingHighlights = [];

  /*
   * Highlight all cells that satisfies a given condition f. Also may
   * highlight numbers that are not appears in all highlighted cells.
   *
   * f is a function that takes the cells position (row, col) as
   * parameter, and return a boolean.
   */
  self.highlightCells = function(f, showMissing) {
    self.setAllButtons(showMissing);
    callForAll(self.cells, function(i, j, cell) {
      cell.isFocused(false);
      if (f(i, j)) {
        cell.peerHighlight(true);
        if (cell.isNotMarker()) {
          self.controlButtons[cell.values()[0]-1].enabled(false);
        }
      } else {
        if (self.oneHighlightOnly) {
          cell.peerHighlight(false);
        };
      }
    });
  };

  /*
   * Highlight a given row, col, square or all of three, also shows
   * the missing numbers in the unit(s)
   */
  self.highlightRow = function(row) {
    self.highlightCells(function(i, j) {return i==row;}, true);
    self.oneHighlightOnly = false;
  };

  self.highlightCol = function(col) {
    self.highlightCells(function(i, j) {return j==col;}, true);
    self.oneHighlightOnly = false;
  };

  self.highlightSquare = function(row, col) {
    self.oneHighlightOnly = true;
    self.highlightCells(function(i, j) {
      return Math.floor(j/3)==col && Math.floor(i/3)==row;
    }, true);
  };

  self.selectCell = function(row, col) {
    self.oneHighlightOnly = true;
    // if the cell contains given value, no need to show missing values
    var showMissing = !self.cells[row][col].isGiven();
    self.highlightCells(function(i, j) {
      return self.isPeer(i, j, row, col);
    }, showMissing);
    self.cells[row][col].isFocused(true);
  };

  /*
   * Highlight all cells that is assigned value v.
   */
  self.selectValue = function(v) {
    self.oneHighlightOnly = true;
    var target = v.value;
    self.highlightCells(function(i, j) {
      var cell = self.cells[i][j];
      return cell.isNotMarker() && cell.values()[0] == target;
    }, false);
    self.controlButtons[target-1].enabled(true);
    self.oneHighlightOnly = false;
  };

  /*
   * Remove all highlights
   */
  self.removeHighlights = function() {
    self.highlightCells(function(i,j) {return false;}, false);
  };

  /*
   * Check confliction between cell(row, col) and all other cells,
   * assuming cell(row, col) has value v.
   *
   * If any other cell also has the value v, increase that cell's
   * conflictCount by delta. (delta may be -1, which means an
   * confliction caused by v is resolved).
   */
  self.conflictCheck = function(row, col, v, delta) {
    var filled = 0;
    var confict = 0;
    var currentCell = self.cells[row][col];
    callForAll(self.cells, function updateConfliction(i, j, cell) {
      filled += cell.isNotMarker()?1:0;
      var isPeer = self.isPeer(i, j, row, col);
      if (isPeer && cell.isNotMarker() && v == cell.values()[0]) {
        cell.conflictCount(cell.conflictCount()+delta);
        currentCell.conflictCount(currentCell.conflictCount()+delta);
      }
      confict += cell.conflictCount();
    }, false);
    self.done(filled == 81 && confict == 0);
  };

  /*
   * Reset the game
   */
  self.reset = function() {
    self.setGame(self.gameString());
  };

  self.oldGame = "";

  /*
   * Put the game pane in 'play' mode, attaching several event handlers to
   * interactive with user inputs.
   */

  self.play = function play(gameString) {
    self.gameString(gameString);
    self.mode({name:'play'});
    $('#game-pane').off();
    ///////////////////////////////////////////
    //     Event handlers
    ///////////////////////////////////////////
    /*
     * clicking on a cell will highlight all its peers
     */
    $('#game-pane').on('click', '.cell', function() {
      var data = ko.dataFor(this);
      gameStateViewModel.selectCell(data.i, data.j);
    });

    /*
     * When focusing on a cell, typing digits (1-9) will add/remove that
     * value to the cell and '0' means remove all value
     */
    $('#game-pane').on('keydown', '.cell', function(e) {
      var key = e.which;
      var data = ko.dataFor(this);
      if (key < 48 || key > 57) return false;
      return gameStateViewModel.addValue(data.i, data.j, ''+(key-48));
    });
    $('#game-pane').on('click', 'td.top-cell', function() {
      var context = ko.contextFor(this);
      self.highlightCol(context.$index());
    });
    $('#game-pane').on('click', 'td.side-cell', function() {
      var context = ko.contextFor(this);
      self.highlightRow(context.$index());
    });


    ////////////////////////////////////////////////////////
    // Simple gesture detections
    //
    // will allow user to select an unit using mouse gesture
    ////////////////////////////////////////////////////////

    var cellsOnPath = [];
    var dragging = false;

    /*
     * add an element to the array unless the element is already in it
     */
    function pushNew(arr, element) {
      var idx = arr.indexOf(element);
      if (idx == -1) {
        arr.push(element);
      }
    }

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
          currentCol=cell.j,
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

    /*
     * When mouse button is down, start tracking the cells that the mouse passed
     */
    $('#game-pane').on('mousedown', '.cell', function(e) {
      var cell = ko.dataFor(this);
      dragging = true;
      cellsOnPath.push(cell);
    });

    /*
     * When the cursor enters a cell, record it
     */
    $('#game-pane').on('mouseenter', '.cell', function(e) {
      if (dragging) {
        pushNew(cellsOnPath, ko.dataFor(this));
      }
    });

    /*
     * When mouse button is up, try to guess the shape and highlight it.
     */
    $('#game-pane').on('mouseup', '.cell', function(e) {
      if (!dragging) return;
      dragging = false;
      var shape = shapeDetect(cellsOnPath);
      cellsOnPath.splice(0, cellsOnPath.length);
      if (shape) {
        switch(shape.type) {
        case 'row':
          gameStateViewModel.highlightRow(shape.row);
          break;
        case 'col':
          gameStateViewModel.highlightCol(shape.col);
          break;
        case 'square':
          gameStateViewModel.highlightSquare(shape.row, shape.col);
          break;
        default:
          break;
        }
      }
    });
  };
  self.mode = ko.observable({name: 'play'});
  self.cancelEdit = function() {
    self.mode({name:'play'});
    self.play(self.oldGame);
  };

  self.startNewGame = function() {
    var editorViewModel = self.mode().viewModel;
    var newGameString = editorViewModel.getGame();
	var normalizedString = normalizeGameString(newGameString);
    if (normalizedString.length!=81) {
      normalizedString = self.oldGame;
    }
    self.play(normalizedString);
  };


  self.getNewGame = function(method) {
	self.oldGame = self.gameString() || '';
	$('#game-pane').off();
	method.viewModel.start();
	self.mode(method);
  };

  self.newGameMethods = [];
  self.registerNewGameMethod = function(name, viewModel) {
	self.newGameMethods.push({name: name, viewModel: viewModel});
  };
  /*
   * clicking outside the game pane will remove all highlights
   */
  $('body').on('click',
               function(e) {
                 var target = e.target;
                 var s = $(target).parents('table').size();
                 if ( s == 0) {
                   self.oneHighlightOnly = true;
                   gameStateViewModel.removeHighlights();
                 }
               }
              );

  $('body').on('click', 'li.new-game', function(e) {
    e.stopPropagation();
	var data = ko.dataFor(this);
	self.getNewGame(data);
  });

};

var PuzzleListViewModel = function (setGame) {
  var self = this;
  self.name = "列表";
  self.setGame = setGame;
  self.puzzleID = ko.observable(1);
  self.puzzleID.subscribe(function(newValue) {
    self.setGame(self.puzzleList[newValue-1] || "");
  });

  self.start = function() {
    if (!self.puzzleID()) {
      self.puzzleID(1);
    }
    self.setGame(self.puzzleList[self.puzzleID()-1] || "");
  };
  self.addPuzzles = function(puzzles) {
    self.puzzleList.push.apply(puzzles);
  };

  self.changePuzzleID = function(v) {
    self.puzzleID(self.puzzleID() + v);
  };
  self.decreaseID = function() {
    self.changePuzzleID(-1);
  };
  self.increaseID = function() {
    self.changePuzzleID(1);
  };
  self.getGame = function() {
    var currentGame = self.puzzleList[self.puzzleID()-1];
	return currentGame;
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

function normalizeGameString(gameString) {
  gameString = gameString.replace(/[^1-9\s]/g, '.');
  return gameString.replace(/\s/g, '');
};

var GameEditorViewModel = function(cells) {
  var self = this;
  var emptyGame =   ".........\n.........\n.........\n.........\n.........\n"
                  + ".........\n.........\n.........\n.........";
  self.cells = cells;
  self.editedGameString = ko.observable("");
  /*
   * Fill the board with given gameString, the gameString may have
   * more or less than 81 valid values.
   */
  self.setGame = function(gameString) {
	var idx = 0;
	callForAll(self.cells, function(i, j, cell) {
      // skip spaces
	  while (idx < gameString.length && gameString.charAt(idx).match(/\s/)) {
		idx++;
	  }
	  cell.init(gameString[idx]);
      idx++;
	});
  };
  self.editedGameString.subscribe(self.setGame);
  self.editedGameString.extend({notify: 'always'});

  /*
   * set up actions for interactive editing the game.
   */
  self.start = function() {
	self.editedGameString(emptyGame);
    $('#game-pane').on('keydown', '.cell', function(e) {
      var cell = ko.dataFor(this);
      var key = e.which;
      if (key < 48 || key > 57) return;

      // assign the value to the cell
      key = ''+ (key-48);
	  if (cell.values()[0] == key) return;
	  cell.init(key);

      // update the editedGameString
	  self.editedGameString(self.gameStringFromCell());
    });
  };
  self.gameStringFromCell = function() {
	var result = [];
	callForAll(self.cells, function(i, j, aCell) {
	  result.push(aCell.values()[0] || '.');
	});
	for (var i=72; i>0; i-=9) {
	  result.splice(i, 0, '\n');
	}
    return result.join('');
  };

  /*
   * get the edited game string
   */
  self.getGame = function() {
    return self.editedGameString();
  };
};
var gameStateViewModel = new GameStateViewModel();
gameStateViewModel.puzzleListViewModel = new PuzzleListViewModel(gameStateViewModel.setGame);
gameStateViewModel.gameEditorViewModel = new GameEditorViewModel(gameStateViewModel.cells);
gameStateViewModel.registerNewGameMethod('输入', gameStateViewModel.gameEditorViewModel);
gameStateViewModel.registerNewGameMethod('题库', gameStateViewModel.puzzleListViewModel);
ko.applyBindings(gameStateViewModel);
gameStateViewModel.setGame(".58...41.7..4.5..32...1...99...4...2.7.....3..6.....5...1...8.....2.7.......5....");
