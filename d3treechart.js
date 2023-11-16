class D3TreeChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    const stylesheetPaths = [];
    const styles = await this.loadStyles(stylesheetPaths);
    this.render(styles);
    this.initializeD3Tree();
  }

  async loadStyles(urls) {
    const styleContents = await Promise.all(
      urls.map((url) => fetch(url).then((resp) => resp.text()))
    );
    return styleContents.join("\n");
  }

  render(styles) {
    console.log(styles);
    this.shadowRoot.innerHTML = `
          <style>
            ${styles}
            :host {
              width: 100%;
              display: flex;
            }
            
        .node circle {
          fill: #fff;
          stroke: steelblue;
          stroke-width: 3px;
        }
  
        .node text {
          font: 10px sans-serif;
        }
  
        .link {
          fill: none;
          stroke: #ccc;
          stroke-width: 2px;
        }
        
        .node circle {
          fill: #fff;
          stroke-width: 3px;
        }
        
        .node--internal circle {
          fill: #555;
        }
        
        .node--internal text {
          text-shadow: 0 1px 0 #fff;
        }
        
        .node--leaf text {
          text-shadow: 0 1px 0 #fff;
        }
        
        .node--leaf circle {
          fill: orange;
        }
        
        .link {
          fill: none;
          stroke: #555;
          stroke-opacity: 0.4;
          stroke-width: 1.5px;
        }
        
        .templink {
          fill: none;
          stroke: red;
          stroke-width: 3px;
        }
        
        .ghostCircle.show {
          display: block;
        }
        
        .ghostCircle, .activeDrag .ghostCircle {
           display: none;
        }
          </style>
          <div class="chart-block">
            <div id="chart"></div>
          </div>
          <section class="tabs-wrapper">
            <div class="tabs-container">
              <div class="tabs-block">
                <div class="tabs">
                  <input type="radio" name="tabs" id="tab1" checked="checked" />
                  <label for="tab1">Person Details</label>
                  <div class="tab" id="person-details-content">
                    <form id="person-form"></form>
                  </div>
                </div>
              </div>
            </div>
          </section>
        `;
  }

  async initializeD3Tree() {
    const response = await fetch("/plan.json");
    const jsonData = await response.json();
    const treeData = this.convertToHierarchy(jsonData);
    let i = 0;
    const duration = 750;
    const nodeWidth = 120;
    const nodeHeight = 20;
    const nodeSpacing = 110;
    const parentThis = this;
    const alignment = "horizontal";
    const styles = {
      nodeBackgroundColor: "rgb(43, 44, 62)",
      nodeBorderColor: "#475872",
      clickedNodeBackgroundColor: "lightsteelblue",
      nodeTextColor: "#333",
      nodeContentKeyColor: "#59b8ff",
      nodeContentValueColor: "#f85c50",
      nodeStrokeColor: "#a5a9e2",
      linkIconColor: "white",
    };

    const margin = { top: 10, right: 20, bottom: 10, left: 20 };
    const width = 1360 - margin.right - margin.left;
    const height = 800 - margin.top - margin.bottom;

    const zoomListener = d3.zoom().on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });

    const svg = d3
      .select(this.shadowRoot.querySelector("#chart"))
      .append("svg")
      .attr("width", width + margin.right + margin.left)
      .attr("height", height + margin.top + margin.bottom)
      .call(zoomListener)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const root = d3.hierarchy(treeData, (d) => d.children);
    root.x0 = height / 2;
    root.y0 = 0;

    root.children.forEach(collapse);

    update(root);

    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    function splitText(text) {
      return text.split(", ");
    }

    function calculateNodeSize(textLines, padding) {
      const lineHeight = 1.1;
      const charWidth = 6;
      let maxWidth = 0;
      const minWidth = 150;
      textLines.forEach(function (lineData) {
        const lineWidth = lineData.displayText.length * charWidth;
        if (lineWidth > maxWidth) maxWidth = lineWidth;
      });

      let width = maxWidth + padding.horizontal;
      let height = textLines.length * lineHeight * 10 + padding.vertical;
      if (width < minWidth) {
        width = minWidth;
      }
      return {
        width: width,
        height: height,
      };
    }

    function update(source) {
      const tree = d3.tree();
      if (alignment === "horizontal") {
        tree.size([height, width]);
      } else {
        tree.size([width, height]);
      }

      const treeData =
        alignment === "horizontal"
          ? d3
              .tree()
              .nodeSize([nodeSpacing, nodeHeight])
              .separation((a, b) => (a.parent == b.parent ? 1 : 1.6))(root)
          : d3
              .tree()
              .nodeSize([nodeWidth * 2.2, nodeSpacing])
              .separation((a, b) => (a.parent == b.parent ? 1 : 1.4))(root);
      const nodes = treeData.descendants();
      const links = treeData.descendants().slice(1);

      if (alignment === "horizontal") {
        nodes.forEach((d) => {
          d.y = d.depth * (nodeWidth * 2 + nodeSpacing);
        });
      } else {
        nodes.forEach((d) => {
          d.y = d.depth * (nodeHeight + nodeSpacing);
        });
      }

      const node = svg
        .selectAll("g.node")
        .data(nodes, (d) => d.id || (d.id = ++i));

      const nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr(
          "transform",
          (d) => "translate(" + source.y0 + "," + source.x0 + ")"
        )
        .on("click", click);

      nodeEnter.each(function (d) {
        const nodeGroup = d3.select(this);
        const textLines = splitText(d.data.name).map((line) => {
          const fullText = line;
          let displayText = line;

          if (displayText.length > 35) {
            displayText = `${displayText.substring(0, 32)}...`;
          }

          return { fullText, displayText };
        });

        const nodeSize = calculateNodeSize(textLines, {
          horizontal: 40,
          vertical: 20,
        });

        d.nodeSize = nodeSize;
        d.textLines = textLines;

        const contentGroup = nodeGroup
          .append("g")
          .attr("class", "node-content");

        contentGroup
          .append("rect")
          .attr("width", nodeSize.width)
          .attr("height", nodeSize.height)
          .attr("x", -nodeSize.width / 2)
          .attr("y", -nodeSize.height / 2)
          .attr("class", "node")
          .style("fill", styles.nodeBackgroundColor)
          .style("stroke", styles.nodeStrokeColor)
          .style("stroke-width", 1)
          .style("border-radius", "5px");

        contentGroup
          .selectAll("text")
          .data(textLines)
          .enter()
          .append("text")
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .attr("x", 0)
          .attr("y", (line, index) => (index - textLines.length / 2 + 0.5) * 10)
          .each(function (lineData) {
            const [key, value] = lineData.displayText.split(/:(.+)/);
            const tspan = d3.select(this);

            tspan
              .append("tspan")
              .style("fill", styles.nodeContentKeyColor)
              .text(key.trim() + ": ");

            if (value) {
              tspan
                .append("tspan")
                .style("fill", styles.nodeContentValueColor)
                .text(value.trim());
            }
          });

        if (d._children || d.children) {
          const iconSize = 16;
          const padding = 23;
          let iconX, iconY;

          if (alignment === "horizontal") {
            iconX = nodeSize.width / 2 - padding;
            iconY = -iconSize / 2;
          } else {
            iconX = -iconSize / 2;
            iconY = nodeSize.height / 2 - 15;
          }

          contentGroup
            .append("image")
            .attr("xlink:href", "/link.svg")
            .attr("x", iconX)
            .attr("y", iconY)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("cursor", "pointer")
            .style("fill", styles.linkIconColor)
            .on("click", function (event) {
              event.stopPropagation();

              if (d.children) {
                d._children = d.children;
                d.children = null;
              } else {
                d.children = d._children;
                d._children = null;
              }

              update(d);
            });
        }
      });

      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate
        .transition()
        .duration(duration)
        .attr("transform", (d) => {
          return alignment === "horizontal"
            ? "translate(" + d.y + "," + d.x + ")"
            : "translate(" + d.x + "," + d.y + ")";
        });

      nodeUpdate
        .select("rect")
        .attr("width", (d) => d.nodeSize.width)
        .attr("height", (d) => d.nodeSize.height);

      nodeUpdate
        .selectAll("text")
        .attr("x", 0)
        .attr(
          "y",
          (line, index, nodes) => (index - nodes.length / 2 + 0.5) * 10
        );

      const nodeExit = node
        .exit()
        .transition()
        .duration(duration)
        .attr(
          "transform",
          (d) => "translate(" + source.y + "," + source.x + ")"
        )
        .remove();

      nodeExit.select("rect").attr("width", 1e-6).attr("height", 1e-6);
      nodeExit.select("text").style("fill-opacity", 1e-6);

      const link = svg.selectAll("path.link").data(links, (d) => d.id);

      const linkEnter = link
        .enter()
        .insert("path", "g")
        .attr("class", "link")
        .attr("d", (d) => {
          console.log(d);
          const o = { x: source.x0, y: source.y0 };
          return diagonal(o, o);
        });

      const linkUpdate = linkEnter.merge(link);

      if (alignment === "horizontal") {
        linkUpdate
          .transition()
          .duration(duration)
          .attr("d", (d) =>
            diagonal(
              { x: d.x, y: d.y - d.nodeSize.width / 2 },
              { x: d.parent.x, y: d.parent.y + d.parent.nodeSize.width / 2 }
            )
          );
      } else {
        linkUpdate
          .transition()
          .duration(duration)
          .attr("d", (d) =>
            diagonal({ x: d.x, y: d.y }, { x: d.parent.x, y: d.parent.y })
          );
      }

      const linkExit = link
        .exit()
        .transition()
        .duration(duration)
        .attr("d", (d) => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      nodes.forEach((d) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });

      function diagonal(s, d) {
        if (alignment === "horizontal") {
          return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        } else {
          return `M ${s.x} ${s.y}
                    C ${s.x} ${(s.y + d.y) / 2},
                      ${d.x} ${(s.y + d.y) / 2},
                      ${d.x} ${d.y}`;
        }
      }

      function click(event, d) {
        parentThis.displayPersonDetails(d);
        d3.select(this)
          .select("rect")
          .style("fill", (d) =>
            d._children
              ? styles.clickedNodeBackgroundColor
              : styles.nodeBackgroundColor
          );
      }
    }
  }

  convertToHierarchy(data) {
    function isPrimitive(value) {
      return value !== Object(value);
    }

    function combinePrimitives(obj) {
      return Object.entries(obj)
        .filter(([k, v]) => isPrimitive(v))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
    }

    function processArrayItems(array, keyPrefix) {
      return array.map((item, index) => {
        if (typeof item === "object" && !Array.isArray(item)) {
          const primitivesCombined = combinePrimitives(item);
          const children = Object.entries(item)
            .map(([k, v]) => (isPrimitive(v) ? null : recurse(v, k)))
            .filter((c) => c);
          return {
            name: `${primitivesCombined}`,
            children,
          };
        } else {
          return { name: `${keyPrefix} ${index + 1}: ${item}` };
        }
      });
    }

    function recurse(value, key) {
      if (value !== null && typeof value === "object") {
        if (Array.isArray(value)) {
          const children = processArrayItems(value, key);
          return { name: key, children };
        } else {
          const primitiveNode = combinePrimitives(value);
          const children = Object.entries(value)
            .map(([k, v]) => (isPrimitive(v) ? null : recurse(v, k)))
            .filter((c) => c);
          const node = primitiveNode ? [{ name: primitiveNode }] : [];
          return { name: key, children: node.concat(children) };
        }
      } else {
        return { name: `${key}: ${value}` };
      }
    }
    console.log(data);
    return recurse(data, "root");
  }

  getParentNames = (node) => {
    let names = [];
    while (node) {
      names.unshift(node.data.name); // Add the node name to the start of the array
      node = node.parent; // Move to the parent node
    }
    return names;
  };

  displayPersonDetails = (node) => {
    console.log(node);
    const form = this.shadowRoot.querySelector("#person-form");
    form.innerHTML = "";

    node.textLines.forEach((line) => {
      const { fullText, displayText } = line; // Destructuring to extract fullText and displayText
      const [key, value] = fullText.split(/:(.+)/);
      if (key && value) {
        const div = document.createElement("div");
        div.setAttribute("class", "form-group");

        const label = document.createElement("label");
        label.setAttribute("for", `person-${key}`);
        label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
        div.appendChild(label);

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("class", "form-control");
        input.setAttribute("id", `person-${key}`);
        input.setAttribute("placeholder", label.textContent);
        input.value = value;
        div.appendChild(input);

        form.appendChild(div);
      }
    });

    const changeRequestButton = document.createElement("button");
    changeRequestButton.setAttribute("id", "change-request-button");
    changeRequestButton.setAttribute(
      "class",
      "btn btn-primary btn-lg btn-block"
    );
    changeRequestButton.innerHTML = "Change Request";
    form.appendChild(changeRequestButton);

    changeRequestButton.addEventListener("click", (e) => {
      e.preventDefault();
      changeRequestButton.style.display = "none";

      const selectDiv = document.createElement("div");
      selectDiv.setAttribute("class", "form-group");

      const selectLabel = document.createElement("label");
      selectLabel.setAttribute("for", "field-select");
      selectLabel.textContent = "Select Field to Update";
      selectDiv.appendChild(selectLabel);

      const selectBox = document.createElement("select");
      selectBox.setAttribute("id", "field-select");
      selectBox.setAttribute("class", "form-control");

      node.textLines.forEach((line) => {
        const { fullText, displayText } = line; // Destructuring to extract fullText and displayText
        const [key, value] = fullText.split(/:(.+)/);
        if (key) {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
          selectBox.appendChild(option);
        }
      });

      selectDiv.appendChild(selectBox);
      form.appendChild(selectDiv);

      const updateButton = document.createElement("button");
      updateButton.setAttribute("id", "update-button");
      updateButton.setAttribute("class", "btn btn-primary mt-2");
      updateButton.innerHTML = "Update";
      form.appendChild(updateButton);

      const cancelButton = document.createElement("button");
      cancelButton.setAttribute("id", "cancel-button");
      cancelButton.setAttribute("class", "btn btn-secondary mt-2 ml-2");
      cancelButton.innerHTML = "Cancel";
      form.appendChild(cancelButton);

      cancelButton.addEventListener("click", (e) => {
        e.preventDefault();
        selectDiv.remove();
        updateButton.remove();
        cancelButton.remove();
        changeRequestButton.style.display = "block";
        this.cancelChangeRequest();
      });

      updateButton.addEventListener("click", (e) => {
        e.preventDefault();
        const selectedKey = selectBox.value;
        const nodeName = node.data.name;
        const parentNames = this.getParentNames(node);

        const inputField = this.shadowRoot.querySelector(
          `#person-${selectedKey}`
        );
        const selectedValue = inputField ? inputField.value : null;

        this.openTicketMasterTab(
          selectedKey,
          selectedValue,
          nodeName,
          parentNames
        );
      });
    });
  };

  cancelChangeRequest = () => {
    const existingInput = this.shadowRoot.querySelector("#tab2");
    const existingLabel = this.shadowRoot.querySelector('label[for="tab2"]');
    const existingTabContent = this.shadowRoot.querySelector(".tab2-content");

    if (existingInput) {
      existingInput.remove();
    }
    if (existingLabel) {
      existingLabel.remove();
    }
    if (existingTabContent) {
      existingTabContent.remove();
    }

    const personDetailsTab = this.shadowRoot.querySelector("#tab1");
    if (personDetailsTab) {
      personDetailsTab.checked = true;
    }
  };

  removeTicketMasterFormTab = () => {
    this.cancelChangeRequest();
  };

  openTicketMasterTab = (
    selectedField,
    selectedValue,
    nodeName,
    parentNames
  ) => {
    const existingTab = this.shadowRoot.querySelector("#tab2");
    if (existingTab) {
      existingTab.checked = true;
      return;
    }

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "tabs";
    input.id = "tab2";
    input.checked = true;

    const label = document.createElement("label");
    label.setAttribute("for", "tab2");
    label.textContent = "Change Request";

    const div = document.createElement("div");
    div.className = "tab";

    const ticketMasterForm = document.createElement("ticket-master-form");
    ticketMasterForm.setAttribute("selected-field", selectedField);
    ticketMasterForm.setAttribute("selected-value", selectedValue);
    ticketMasterForm.setAttribute("node-name", nodeName);
    ticketMasterForm.setAttribute("parent-names", parentNames.join("$$NL$$"));
    console.log("selected-field", parentNames.join("$$NL$$"));
    div.appendChild(ticketMasterForm);

    const tabsContainer = this.shadowRoot.querySelector(".tabs");
    tabsContainer.appendChild(input);
    tabsContainer.appendChild(label);
    tabsContainer.appendChild(div);
  };
}

window.customElements.define("d3-tree-dashboard", D3TreeChart);

function nodeDoubleClick(e, obj) {
  const clicked = obj.part;
  if (clicked !== null) {
    const thisNode = clicked.data;
    const diagram = clicked.diagram;
    if (thisNode !== null) {
      const node = diagram.findNodeForKey(thisNode.key);
      if (node !== null) {
        node.isTreeExpanded = !node.isTreeExpanded;
        diagram.layout.invalidateLayout();
      }
    }
  }
}
