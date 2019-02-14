$(function() { // on page load
  // Create the tree inside the <div id="tree"> element.
  let glyph_opts = {
    preset: "bootstrap3",
    map: {}
  };

  let restoreInProgress = false;
  let $treetable = $("#treetable").fancytree({
    extensions: ["glyph", "table"],
    checkbox: true,
    clickFolderMode: 2,
    glyph: glyph_opts,
    source: bup_source,
    lazyLoad: bup_lazyLoad,
    clickPaging: bup_clickPaging,
    table: {
      checkboxColumnIdx: 0,
      nodeColumnIdx: 1
    },
    renderColumns: function(event, data) {
      var node = data.node,
        $tdList = $(node.tr).find(">td");
      //$tdList.eq(0).text(node.getIndexHier());

      $tdList.eq(2).text(node.data.size);
      if (node.data.date && node.data.date.getTime() !== 0) {
        let mdate = moment(node.data.date);
        $tdList.eq(3).text(mdate.format('MMM D, YYYY [at] h:mm a'));
      }
    },
    collapse: function(event, data) {
      if(data.node.data.branch === true) {
        data.node.resetLazy();
      }
    },
    beforeSelect: function(event, data) {
      return !restoreInProgress;
    },
    select: function(event, data) {
      let selectedNodes = tree.getSelectedNodes();
      if(selectedNodes.length > 0) {
        $('#restore-btn').prop("disabled", false);
      } else {
        $('#restore-btn').prop("disabled", true);
      }
    }

  });
  let tree = $treetable.fancytree('getTree');

  $('#quitapp-btn').on('click', function(e) {
    e.preventDefault();
    quitApp();
  });

  $('#restore-btn').on('click', function(e) {
    e.preventDefault();
    let $btn = $(this);

    restoreInProgress = true;
    $('#restore-btn').prop("disabled", true);
    $btn.html('<i class="fas fa-spinner fa-spin"></i> Restore');

    bup_selectRestoreDirectory((files, bookmarks) => {
      if(files && files.length > 0) {
        (async function() {
          const nodes = tree.getSelectedNodes();
          const toRestorePaths = nodes.map(_ => node_key_path(_,''));
          const restorePoint = files[0];

          await bup_restore(restorePoint, toRestorePaths);

          $btn.html('Restore');
          $('#restore-btn').prop("disabled", false);
          restoreInProgress = false;
        })().catch(console.error);
      } else {
        $btn.html('Restore');
        $('#restore-btn').prop("disabled", false);
        restoreInProgress = false;
      }
    });
  });
});
