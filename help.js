function startIntro(){
        var intro = introJs();
          intro.setOptions({
            steps: [
              {
                element: document.querySelector('H1'),
                intro: "和你的家人朋友一起玩Sudoku."
              },
              {
                element: document.querySelector('#newgame'),
                intro: "首先选择题目."
              },
              {
                element: document.querySelector('#newgame-List'),
                intro: "可以从已有的题目中选择"
              },
              {
                element: document.querySelector('#newgame-Edit'),
                intro: "也可以自己输入题目"
              }
            ]
          });

          intro.start();
      }