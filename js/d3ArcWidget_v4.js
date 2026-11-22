// d3ChargingWidget_v4.js
// Reusable d3 v4 chart factory following the Mike Bostock closure/callable pattern.
// Covers shared logic from d3chargingArc1.js and d3chargingAltGraph1_v4.js.
//
// CDN load order (load this file last):
//   <script src="https://d3js.org/d3.v4.min.js"></script>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js"></script>
//   <script src="./d3ChargingWidget_v4.js"></script>
//
// Render strategies: "tree" | "arc"
// Usage: see USAGE EXAMPLES block at bottom of file.

//LATEST ADDITIONS:
//1. Example for switching callbacks for togglebutton behavior.
//container.selectAll("*").remove();
//d3.select(container).call(activeChart);
//
//2. d3-legend CDN (load after d3.v4.min.js):
//https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js

(function(global) {

  // ---------------------------------------------------------------------------
  // Core factory — returns a callable chart function (d3 axis-style)
  // ---------------------------------------------------------------------------
  function chargingChart() {

    // --- configurable properties with defaults ---
    var margin        = { top: 80, right: 120, bottom: 80, left: 120 };
    var width         = 1280 - margin.right - margin.left;
    var height        = 655  - margin.top   - margin.bottom;
    var dataUrl       = "";
    var selector      = "#my_dataviz";
    var bgColor       = "#91a3b0";
    var initialScale  = 0.65;
    var initialTx     = 0.50;
    var initialTy     = 0;
    var depthSpacing  = 420;         // tree only — ignored by arc renderer
    var colorMap      = null;        // optional name→color lookup (tree mode)
    var colorScale    = null;        // optional d3 scale (arc mode)
    var renderStrategy = null;       // REQUIRED: "tree" | "arc"
    var legendSelector = null;       // optional CSS selector for legend container
    var postPayload    = null;       // Only POST requests allowed with JSON for d3.json for more security
    
    // --- the callable chart function — invoke via d3.select(el).call(chart) ---
    function chart(selection) {

      // shared zoom behaviour — applied to g group so SVG root captures events
      var zoom = d3.zoom().scaleExtent([0.8, 1.5]).on("zoom", function() {
        g.attr("transform", d3.event.transform);
      });

      var svgRoot = selection.append("svg")
          .attr("width",  width  + margin.left + margin.right)
          .attr("height", height + margin.top  + margin.bottom)
          .style("background-color", bgColor)
          .style("border-radius", "5px")
          .call(zoom);

      var g = svgRoot.append("g").attr("transform","translate(" + margin.right + "," + margin.top + ")scale(0.8)");


    // -------------------------------------------------------------------------
    // Additional Conditional Rendering functionality for post, static get
    // -------------------------------------------------------------------------

function _render(data) {
  if (!data) { console.error("chargingChart: failed to load", dataUrl); return; }
  //var payload = (data.data && data.data.nodes) ? data.data : data;
  if (renderStrategy === "tree") {
    _renderTree(svgRoot, g, zoom, data);
    if (legendSelector) _renderLegend(legendSelector, renderStrategy);
  } else if (renderStrategy === "arc") {
    var colorForLegend = _renderArc(g, data);
    if (legendSelector) _renderLegend(legendSelector, renderStrategy, colorForLegend);
  } else {
    console.error("chargingChart: renderStrategy must be 'tree' or 'arc'");
  }
}



      // POST-only guard — widget rejects requests without a well-formed JSON payload
      // DEPRECATED: Now widget supports GET (via url directly) as well.
     // _post(dataUrl, postPayload, function(data) {
     //   if (!data) { console.error("chargingChart: failed to load", dataUrl); return; }
     postPayload ? _post(dataUrl, postPayload, function(data) { _render(data); })
                 : _get(dataUrl, function(err, data) { _render(err ? null : data); });



        /*if (renderStrategy === "tree") {
          _renderTree(svgRoot, g, zoom, data);
          if (legendSelector) _renderLegend(legendSelector, renderStrategy);
        } else if (renderStrategy === "arc") {
          var colorForLegend = _renderArc(g, data);
          if (legendSelector) _renderLegend(legendSelector, renderStrategy, colorForLegend);
        } else {
          console.error("chargingChart: renderStrategy must be 'tree' or 'arc'");
        }
      });*/
    }


    // -------------------------------------------------------------------------
    // POST-only XHR helper (d3 v4 xhr — no fetch API dependency)
    // Aborts and returns early if postPayload is not a non-null object,
    // enforcing that the widget only ever issues well-formed JSON POST requests.
    // -------------------------------------------------------------------------
    function _post(url, payload, callback) {
      if (!payload || typeof payload !== "object") { return; }
      d3.request(url)
        .header("Content-Type", "application/json")
        .response(function(xhr) { return JSON.parse(xhr.responseText); })
        .post(JSON.stringify(payload), callback);
    }

function _get(url, callback) {
  if (!url) { return; }
  d3.json(url, callback);
}

    // -------------------------------------------------------------------------
    // Tree renderer — horizontal pre-expanded tree (from d3chargingAltGraph1_v4.js)
    // -------------------------------------------------------------------------
    function _renderTree(svgRoot, g, zoom, data) {
      var tree     = d3.tree();
      var diagonal = d3.linkHorizontal()
          .x(function(d) { return d.y; })
          .y(function(d) { return d.x; });

      var root      = d3.hierarchy(data);
      var dynHeight = Math.max(root.descendants().length * 20, height);

      tree.size([dynHeight, width]);
      svgRoot.attr("height", dynHeight + margin.top + margin.bottom);

      // apply initial scale+translate through zoom so state stays in sync on user interaction
      var initTransform = d3.zoomIdentity
          .translate(initialTx + margin.left, initialTy + margin.top)
          .scale(initialScale);
      svgRoot.call(zoom.transform, initTransform);

      tree(root);

      // override d3.tree x/y with fixed depth-based horizontal spacing
      root.descendants().forEach(function(d) { d.y = d.depth * depthSpacing; });

      // links
      g.selectAll("path.link")
          .data(root.links())
        .enter().insert("path", "g")
          .attr("class", "link")
          .attr("d", diagonal);

      // nodes
      var node = g.selectAll("g.node")
          .data(root.descendants())
        .enter().append("g")
          .attr("class", "node")
          .attr("transform", function(d) {
            return "translate(" + d.y + "," + d.x + ")";
          });

      // circle — fill from colorMap if provided, else default lightsteelblue
      node.append("circle")
          .attr("r", 10)
          .style("fill", function(d) {
            return colorMap ? (colorMap[d.data.name] || "lightsteelblue") : "lightsteelblue";
          });

      // label
      node.append("text")
          .attr("x", 15)
          .attr("dy", ".35em")
          .attr("text-anchor", "start")
          .text(function(d) { return d.data.name; });
    }



     // ----------------------------------------------------------------------------
     // Helper function - set basic props on legend re-rendering  
     // ----------------------------------------------------------------------------
    function colorizeLegend() {
      d3.select("#svg_legend > svg > g > text").style("fill","#536878");
      
      d3.select("#svg_legend > svg > g > g > g:nth-child(1) > text").style("fill","#536878");
      d3.select("#svg_legend > svg > g > g > g:nth-child(2) > text").style("fill","#536878");
      d3.select("#svg_legend > svg > g > g > g:nth-child(3) > text").style("fill","#536878");
      d3.select("#svg_legend > svg > g > g > g:nth-child(4) > text").style("fill","#536878");
    }

    // -------------------------------------------------------------------------
    // Legend renderer — uses d3-legend (d3.legendColor)
    // Accepts the color scale built by whichever renderer ran first.
    // -------------------------------------------------------------------------
    function _renderLegend(sel, strategy, colorScale) {
      var container = d3.select(sel);
      container.selectAll("*").remove();

      var legendSvg = container.append("svg").attr("width", 220);

      if (strategy === "tree") {
        // tree uses a fixed colorMap — build a transient ordinal scale from it
                
        var entries = colorMap
          ? Object.keys(colorMap).map(function(k) { return { label: k, color: colorMap[k] }; })
          : [];
        //entries.push({ label: "(other)", color: "lightsteelblue" });

        var treeScale = d3.scaleOrdinal()
            .domain(entries.map(function(e) { return e.label; }))
            .range(entries.map(function(e) { return e.color; }));

        var legend = d3.legendColor()
            .scale(treeScale)
            .title("Legend:");

        legendSvg.attr("height", entries.length * 22 + 30)
          .append("g")
            .attr("transform", "translate(10,20)")
            .call(legend);
          
          colorizeLegend();
            
      } else if (strategy === "arc" && colorScale) {
        // arc passes back its scaleOrdinal so legend matches node fill exactly
        var legend = d3.legendColor()
            .scale(colorScale).labels(["N","L","A.N.","P"])
            .title("Legend:");

        legendSvg.attr("height", colorScale.domain().length * 22 + 30)
          .append("g")
            .attr("transform", "translate(10,20)")
            .call(legend);
            
            colorizeLegend();
      }

    }

    // -------------------------------------------------------------------------
    // Arc renderer — arc/chord diagram (from d3chargingArc1.js)
    // Returns the color scale so _renderLegend can consume the same instance.
    // -------------------------------------------------------------------------
    function _renderArc(g, data) {
      var allNodes  = data.nodes.map(function(d) { return d.name; });
      var allGroups = [...new Set(data.nodes.map(function(d) { return d.grp; }))];

      // use injected colorScale if provided, otherwise default to schemeSet3
      var color = colorScale || d3.scaleOrdinal()
          .domain(allGroups)
          .range(d3.schemeSet3);

      var size = d3.scaleLinear().domain([1, 10]).range([2, 10]);
      var x    = d3.scalePoint().range([0, width]).domain(allNodes);

      // id→node lookup for resolving link source/target
      var idToNode = {};
      data.nodes.forEach(function(n) { idToNode[n.id] = n; });

      // links — elliptical arc paths
      var links = g.selectAll("mylinks")
          .data(data.links)
        .enter().append("path")
          .attr("d", function(d) {
            var start = x(idToNode[d.source].name);
            var end   = x(idToNode[d.target].name);
            return ["M", start, height - 30,
                    "A", (start - end) / 2, ",", (start - end) / 2, 0, 0, ",",
                    start < end ? 1 : 0, end, ",", height - 30]
                   .join(" ");
          })
          .style("fill", "none")
          .attr("stroke", "#536878")
          .style("stroke-width", 1);

      // nodes — circles sized by n value, coloured by group
      var nodes = g.selectAll("mynodes")
          .data(data.nodes.sort(function(a, b) { return +b.n - +a.n; }))
        .enter().append("circle")
          .attr("cx", function(d) { return x(d.name); })
          .attr("cy", height - 30)
          .attr("r",  function(d) { return size(d.n); })
          .style("fill", function(d) { return color(d.grp); })
          .attr("stroke", "white");

      // labels — rotated -45deg below arc baseline
      var labels = g.selectAll("mylabels")
          .data(data.nodes)
        .enter().append("text")
          .attr("x", 0).attr("y", 0)
          .text(function(d) { return d.name; })
          .style("text-anchor", "end")
          .attr("transform", function(d) {
            return "translate(" + x(d.name) + "," + (height - 15) + ")rotate(-45)";
          })
          .style("font-size", 16);

      // mouseover — dim all nodes except hovered, highlight connected links
      nodes
        .on("mouseover", function(d) {
          nodes.style("opacity", .2);
          d3.select(this).style("opacity", 1);
          links
            .style("stroke", function(l) {
              return l.source === d.id || l.target === d.id ? color(d.grp) : "#536878";
            })
            .style("stroke-opacity", function(l) {
              return l.source === d.id || l.target === d.id ? 1 : .5;
            })
            .style("stroke-width", function(l) {
              return l.source === d.id || l.target === d.id ? 4 : 1;
            });
          labels
            .style("font-size",   function(l) { return l.name === d.name ? 16 : 20; })
            .style("font-weight", function(l) { return l.name === d.name ? "bold" : "normal"; })
            .style("text-shadow", function(l) { return l.name === d.name ? "#FFFF00 4px 2px 1px" : "none"; })
            .attr("y",            function(l) { return l.name === d.name ? 10 : 0; });
        })
        // mouseout — restore all defaults
        .on("mouseout", function() {
          nodes.style("opacity", 1);
          links
            .style("stroke", "#536878")
            .style("stroke-opacity", .8)
            .style("stroke-width", "1");
          labels
            .style("font-weight", "normal")
            .style("text-shadow", "none")
            .style("font-size", 16);
        });

      return color; // returned so _renderLegend can consume the same scale
    }

    // -------------------------------------------------------------------------
    // Chainable setters — d3 axis-style fluent API
    // getter: chart.prop()        setter: chart.prop(value)
    //  '_' d3 the same as alias for 'value' (generic convention for d3.js internal aliasing)
    // -------------------------------------------------------------------------
    chart.margin         = function(_) { return arguments.length ? (margin         = _, chart) : margin; };
    chart.width          = function(_) { return arguments.length ? (width          = _, chart) : width; };
    chart.height         = function(_) { return arguments.length ? (height         = _, chart) : height; };
    chart.dataUrl        = function(_) { return arguments.length ? (dataUrl        = _, chart) : dataUrl; };
    chart.selector       = function(_) { return arguments.length ? (selector       = _, chart) : selector; };
    chart.bgColor        = function(_) { return arguments.length ? (bgColor        = _, chart) : bgColor; };
    chart.initialScale   = function(_) { return arguments.length ? (initialScale   = _, chart) : initialScale; };
    chart.initialTx      = function(_) { return arguments.length ? (initialTx      = _, chart) : initialTx; };
    chart.initialTy      = function(_) { return arguments.length ? (initialTy      = _, chart) : initialTy; };
    chart.depthSpacing   = function(_) { return arguments.length ? (depthSpacing   = _, chart) : depthSpacing; };
    chart.colorMap       = function(_) { return arguments.length ? (colorMap       = _, chart) : colorMap; };
    chart.colorScale     = function(_) { return arguments.length ? (colorScale     = _, chart) : colorScale; };
    chart.renderStrategy = function(_) { return arguments.length ? (renderStrategy = _, chart) : renderStrategy; };
    chart.legendSelector = function(_) { return arguments.length ? (legendSelector = _, chart) : legendSelector; };
    chart.postPayload    = function(_) { return arguments.length ? (postPayload    = _, chart) : postPayload; };
    
    return chart;
  }

  // expose factory on global scope (window in browser)
  global.chargingChart = chargingChart;

}(typeof window !== "undefined" ? window : this));


// =============================================================================
// USAGE EXAMPLES — not executed, for reference and testing
// =============================================================================

/*
  HTML scaffold — CDN load order matters:

  <script src="https://d3js.org/d3.v4.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js"></script>
  <script src="./d3ChargingWidget_v4.js"></script>

  Page layout:

  <div id="chart"></div>
  <div id="legend"></div>
  <button id="btn-tree">Tree</button>
  <button id="btn-arc">Arc</button>


  --- TREE chart instance ---

  var treeChart = chargingChart()
      .dataUrl("/json/static_data.json")
      .renderStrategy("tree")
      .initialScale(0.65)
      .initialTx(0.50)
      .depthSpacing(420)
      .legendSelector("#legend")
      .colorMap({
          "N":    "olive",
          "L":    "yellow",
          "A.N.": "orange",
          "P":    "red"
      });


  --- ARC chart instance ---

  var arcChart = chargingChart()
      .dataUrl("/json/static_data.json")
      .renderStrategy("arc")
      .legendSelector("#legend");
      // colorScale() omitted — defaults to d3.scaleOrdinal + d3.schemeSet3


  --- Toggle / switch wiring ---

  var activeChart = treeChart;
  var container   = document.getElementById("chart");

  function switchChart(next) {
      d3.select(container).selectAll("*").remove();  // clear chart
      d3.select("#legend").selectAll("*").remove();  // clear legend
      activeChart = next;
      d3.select(container).call(activeChart);
  }

  document.getElementById("btn-tree").addEventListener("click", function() { switchChart(treeChart); });
  document.getElementById("btn-arc").addEventListener("click",  function() { switchChart(arcChart);  });

  // initial render on page load
  d3.select(container).call(activeChart);
*/
