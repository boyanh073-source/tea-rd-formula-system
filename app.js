const STORE_KEY = "tea-rd-local-draft-v1";
const API_ENABLED = !window.FORCE_LOCAL_MODE && location.protocol !== "file:";

const defaults = {
  settings: {
    teaPrimaryCategories: ["绿茶", "红茶", "乌龙茶", "黄茶", "白茶", "黑茶", "花茶", "其他代用茶"],
    additiveCategories: ["香原料", "其他"],
    generalCategories: ["乳制品", "果汁果酱", "其他"],
    blendStatuses: ["前期提案", "初测通过", "区域测试", "成品"],
  },
  state: {
    materials: [
      {
        id: "T-001",
        name: "云南大叶种红茶",
        group: "tea",
        primaryCategory: "红茶",
        secondaryCategory: "大叶种红茶",
        origin: "云南",
        style: "蜜香、厚度高",
        note: "",
        createdAt: today(),
      },
      {
        id: "A-001",
        name: "白桃香精",
        group: "additive",
        category: "香原料",
        secondaryCategory: "果香",
        style: "白桃前调",
        note: "",
        createdAt: today(),
      },
      {
        id: uid("GEN"),
        name: "白桃浓缩汁",
        group: "general",
        category: "果汁果酱",
        secondaryCategory: "浓缩汁",
        supplier: "测试供应商",
        createdAt: today(),
      },
    ],
    blends: [],
    freshFormulas: [],
    rtdFormulas: [],
  },
};

let data = loadData();
let currentView = "materials";
let materialTab = "tea";
let formulaTab = "fresh";
let editing = { materials: "", blends: "", freshFormulas: "", rtdFormulas: "" };

const root = document.querySelector("#view-root");
const title = document.querySelector("#page-title");
const kicker = document.querySelector("#page-kicker");
const searchInput = document.querySelector("#search-input");

const viewMeta = {
  materials: ["原料库", "茶叶原料库 / 香精添加剂库 / 配料库"],
  blends: ["拼配方案库", "调用茶叶原料库和香精/添加剂原料库"],
  formulas: ["成品配方库", "包含现制茶饮配方库和 RTD 饮料配方库"],
  records: ["其他记录", "待后续设计"],
  settings: ["设置", "维护下拉选项"],
};

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    searchInput.value = "";
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

searchInput.addEventListener("input", render);

initApp();

function render() {
  const [pageTitle, pageKicker] = viewMeta[currentView];
  title.textContent = pageTitle;
  kicker.textContent = pageKicker;
  if (currentView === "materials") renderMaterials();
  if (currentView === "blends") renderBlends();
  if (currentView === "formulas") renderFormulas();
  if (currentView === "records") renderRecords();
  if (currentView === "settings") renderSettings();
}

function renderMaterials() {
  const config = {
    tea: ["茶叶原料库", teaMaterialForm],
    additive: ["香精/添加剂原料库", additiveMaterialForm],
    general: ["配料库", generalMaterialForm],
  };
  const [tabTitle, formRenderer] = config[materialTab];
  const records = filterRecords(materials(materialTab));
  root.innerHTML = `
    <div class="subnav">
      ${Object.entries(config)
        .map(([key, value]) => `<button class="subnav-item ${key === materialTab ? "active" : ""}" data-material-tab="${key}" type="button">${value[0]}</button>`)
        .join("")}
    </div>
    <div class="layout">
      ${formRenderer()}
      ${library("materials", records, materialCard, `${tabTitle}资料`, `共 ${records.length} 条`)}
    </div>
  `;
  bindMaterialTabs();
  bindMaterialForms();
  bindCards("materials");
}

function renderBlends() {
  const records = filterRecords(data.state.blends);
  root.innerHTML = `
    <div class="blend-layout">
      ${blendForm()}
      ${library("blends", records, blendCard, "拼配方案资料", `共 ${records.length} 条`)}
    </div>
  `;
  bindBlendForm();
  bindCards("blends");
}

function renderFormulas() {
  const collection = formulaTab === "rtd" ? "rtdFormulas" : "freshFormulas";
  const records = filterRecords(data.state[collection]);
  root.innerHTML = `
    <div class="subnav">
      <button class="subnav-item ${formulaTab === "fresh" ? "active" : ""}" data-formula-tab="fresh" type="button">现制茶饮配方库</button>
      <button class="subnav-item ${formulaTab === "rtd" ? "active" : ""}" data-formula-tab="rtd" type="button">RTD饮料配方库</button>
    </div>
    <div class="layout">
      ${formulaTab === "fresh" ? freshFormulaForm() : rtdFormulaForm()}
      ${library(collection, records, formulaTab === "fresh" ? freshFormulaCard : rtdFormulaCard, formulaTab === "fresh" ? "现制茶饮配方资料" : "RTD饮料配方资料", `共 ${records.length} 条`)}
    </div>
  `;
  bindFormulaTabs();
  if (formulaTab === "fresh") bindFreshFormulaForm();
  if (formulaTab === "rtd") bindRtdFormulaForm();
  bindCards(collection);
}

function renderRecords() {
  root.innerHTML = `
    <section class="notice">
      <p class="eyebrow">暂不展开</p>
      <h2>其他记录</h2>
      <p class="hint">这里先保留入口，等你重新定义生产、测试或其他记录逻辑后再设计。</p>
    </section>
  `;
}

function renderSettings() {
  const s = data.settings;
  root.innerHTML = `
    <form id="settings-form" class="form">
      <div class="settings-grid">
        ${settingsBox("teaPrimaryCategories", "茶叶一级分类", s.teaPrimaryCategories)}
        ${settingsBox("additiveCategories", "香精/添加剂分类", s.additiveCategories)}
        ${settingsBox("generalCategories", "配料库一级分类", s.generalCategories)}
        ${settingsBox("blendStatuses", "拼配方案状态", s.blendStatuses)}
      </div>
      <div class="button-row">
        <p id="settings-message" class="form-message"></p>
        <button class="primary-button" type="submit">保存设置</button>
      </div>
    </form>
  `;
  document.querySelector("#settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    ["teaPrimaryCategories", "additiveCategories", "generalCategories", "blendStatuses"].forEach((key) => {
      data.settings[key] = lines(form.get(key));
    });
    saveData();
    show("settings-message", "已保存。");
  });
}

function teaMaterialForm() {
  return `
    <section class="panel">
      <div class="panel-head"><div><h2>${editing.materials ? "修改茶叶原料" : "录入茶叶原料"}</h2></div></div>
      <form id="tea-material-form" class="form">
        <div class="form-grid">
          <label><span>原料名称</span><input name="name" required /></label>
          <label><span>原料编号</span><input name="id" required /></label>
          <label><span>一级分类</span><select name="primaryCategory">${options(data.settings.teaPrimaryCategories)}</select></label>
          <label><span>二级分类</span><input name="secondaryCategory" /></label>
          <label><span>产地</span><input name="origin" /></label>
          <label><span>风格</span><input name="style" /></label>
        </div>
        <label><span>备注</span><textarea name="note" rows="2"></textarea></label>
        ${formActions("tea-material-message", "录入茶叶原料", "materials")}
      </form>
    </section>
  `;
}

function additiveMaterialForm() {
  return `
    <section class="panel">
      <div class="panel-head"><div><h2>${editing.materials ? "修改香精/添加剂" : "录入香精/添加剂"}</h2></div></div>
      <form id="additive-material-form" class="form">
        <div class="form-grid">
          <label><span>名称</span><input name="name" required /></label>
          <label><span>编号</span><input name="id" required /></label>
          <label><span>分类</span><select name="category">${options(data.settings.additiveCategories)}</select></label>
          <label><span>二级分类</span><input name="secondaryCategory" /></label>
          <label><span>风格</span><input name="style" /></label>
        </div>
        <label><span>备注</span><textarea name="note" rows="2"></textarea></label>
        ${formActions("additive-material-message", "录入添加剂", "materials")}
      </form>
    </section>
  `;
}

function generalMaterialForm() {
  return `
    <section class="panel">
      <div class="panel-head"><div><h2>${editing.materials ? "修改配料" : "录入配料"}</h2></div></div>
      <form id="general-material-form" class="form">
        <div class="form-grid">
          <label><span>名称</span><input name="name" required /></label>
          <label><span>供应商</span><input name="supplier" /></label>
          <label><span>一级分类</span><select name="category">${options(data.settings.generalCategories)}</select></label>
          <label><span>二级分类</span><input name="secondaryCategory" /></label>
        </div>
        ${formActions("general-material-message", "录入配料", "materials")}
      </form>
    </section>
  `;
}

function blendForm() {
  return `
    <section class="panel blend-panel">
      <div class="panel-head"><div><h2>${editing.blends ? "修改拼配方案" : "拼配方案录入"}</h2></div></div>
      <form id="blend-form" class="form">
        <section class="form-section">
          <h3>基础信息</h3>
          <div class="blend-basic-grid">
            <label><span>拼配名称</span><input name="name" required /></label>
            <label><span>拼配编号</span><input name="id" required /></label>
            <label><span>面向客户</span><input name="customer" /></label>
            <label><span>状态</span><select name="status">${options(data.settings.blendStatuses)}</select></label>
          </div>
        </section>
        <section class="form-section">
          <div class="ingredient-head">
            <h3>原料</h3>
            <button class="ghost-button small-button" id="add-blend-row" type="button">新增原料</button>
          </div>
          <div id="blend-material-rows">${blendMaterialRow(1)}${blendMaterialRow(2)}</div>
          ${blendDatalists()}
        </section>
        <section class="form-section">
          <h3>拼配方式</h3>
          <label><span>说明</span><textarea name="method" rows="3"></textarea></label>
        </section>
        ${formActions("blend-message", "录入拼配", "blends")}
      </form>
    </section>
  `;
}

function freshFormulaForm() {
  return `
    <section class="panel">
      <div class="panel-head"><div><h2>${editing.freshFormulas ? "修改现制茶饮配方" : "现制茶饮配方录入"}</h2></div></div>
      <form id="fresh-formula-form" class="form">
        <section class="form-section">
          <h3>基础信息</h3>
          <div class="form-grid">
            <label><span>名称</span><input name="name" required /></label>
            <label><span>面向客户</span><input name="customer" /></label>
            <label><span>状态</span><input name="status" /></label>
            <label><span>版本</span><input name="version" /></label>
          </div>
        </section>
        <section class="form-section">
          <div class="ingredient-head">
            <h3>茶叶冲泡</h3>
            <button class="ghost-button small-button" id="add-brew-row" type="button">新增茶汤</button>
          </div>
          <div id="brew-rows">${brewRow(1)}</div>
          ${formulaTeaDatalists()}
        </section>
        <section class="form-section">
          <div class="ingredient-head">
            <h3>饮品出品</h3>
            <button class="ghost-button small-button" id="add-output-row" type="button">新增原料</button>
          </div>
          <div id="output-rows">${outputRow(1)}${outputRow(2)}</div>
          ${freshOutputDatalists()}
        </section>
        <section class="form-section">
          <h3>SOP</h3>
          <label><span>说明</span><textarea name="sop" rows="4"></textarea></label>
        </section>
        ${formActions("fresh-message", "录入现制茶饮配方", "freshFormulas")}
      </form>
    </section>
  `;
}

function rtdFormulaForm() {
  return `
    <section class="panel">
      <div class="panel-head"><div><h2>${editing.rtdFormulas ? "修改RTD饮料配方" : "RTD饮料配方录入"}</h2></div></div>
      <form id="rtd-formula-form" class="form">
        <section class="form-section">
          <h3>基础信息</h3>
          <div class="form-grid">
            <label><span>名称</span><input name="name" required /></label>
            <label><span>面向客户</span><input name="customer" /></label>
            <label><span>状态</span><input name="status" /></label>
            <label><span>版本</span><input name="version" /></label>
          </div>
        </section>
        <section class="form-section">
          <div class="ingredient-head">
            <h3>茶汤萃取</h3>
            <button class="ghost-button small-button" id="add-rtd-tea-row" type="button">新增茶叶</button>
          </div>
          <div id="rtd-tea-rows">${rtdTeaRow(1)}</div>
          <div class="form-grid extraction-grid">
            <label><span>萃取水温</span><input name="extractTemperature" /></label>
            <label><span>萃取时间</span><input name="extractTime" /></label>
            <label><span>冲泡茶水比</span><input name="brewTeaWaterRatio" /></label>
            <label><span>定容茶水比</span><input name="finalTeaWaterRatio" /></label>
          </div>
          ${rtdTeaDatalists()}
        </section>
        <section class="form-section">
          <div class="ingredient-head">
            <h3>调配方案</h3>
            <button class="ghost-button small-button" id="add-rtd-mix-row" type="button">新增原料</button>
          </div>
          <div class="rtd-mix-table">
            <div class="rtd-mix-head"><span>原料类型</span><span>原料名</span><span>添加量（每升）</span><span></span></div>
            <div id="rtd-mix-rows">${rtdMixRow(1)}${rtdMixRow(2)}</div>
          </div>
          ${rtdMixDatalists()}
        </section>
        ${formActions("rtd-message", "录入RTD饮料配方", "rtdFormulas")}
      </form>
    </section>
  `;
}

function blendMaterialRow(index) {
  return `
    <div class="blend-material-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">原料 ${index}</span>
        <label><span>类型</span><select name="type">${options(["茶叶", "添加剂"])}</select></label>
        <label><span>添加量(%)</span><input name="amount" /></label>
        <button class="danger-button row-delete-button" data-remove-row type="button">删除</button>
      </div>
      <div class="blend-material-main">
        <label><span>原料名称</span><input name="name" list="blend-tea-name-options" /></label>
        <label><span>原料编号</span><input name="materialId" list="blend-tea-id-options" /></label>
      </div>
    </div>
  `;
}

function brewRow(index) {
  return `
    <div class="formula-brew-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">茶汤 ${index}</span>
        <button class="danger-button row-delete-button" data-remove-row type="button">删除</button>
      </div>
      <div class="formula-brew-grid">
        <label><span>茶叶名称</span><input name="teaName" list="formula-tea-name-options" /></label>
        <label><span>茶叶编号</span><input name="teaId" list="formula-tea-id-options" /></label>
        <label><span>茶叶量</span><input name="teaAmount" /></label>
        <label><span>冲泡水温</span><input name="temperature" /></label>
        <label><span>冲泡时间</span><input name="time" /></label>
        <label><span>热水量</span><input name="hotWater" /></label>
        <label><span>冰块量</span><input name="ice" /></label>
      </div>
    </div>
  `;
}

function outputRow(index) {
  return `
    <div class="formula-material-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">原料 ${index}</span>
        <label><span>类型</span><select name="type">${options(freshOutputTypes())}</select></label>
        <button class="danger-button row-delete-button" data-remove-row type="button">删除</button>
      </div>
      <div class="blend-material-main">
        <label><span>原料名称</span><input name="name" list="fresh-output-soup-options" /></label>
        <label><span>用量</span><input name="amount" /></label>
      </div>
    </div>
  `;
}

function rtdTeaRow(index) {
  return `
    <div class="formula-material-row rtd-tea-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">茶叶 ${index}</span>
        <button class="danger-button row-delete-button" data-remove-row type="button">删除</button>
      </div>
      <div class="blend-material-main">
        <label><span>茶叶名</span><input name="teaName" list="rtd-tea-name-options" /></label>
        <label><span>茶叶编号</span><input name="teaId" list="rtd-tea-id-options" /></label>
      </div>
    </div>
  `;
}

function rtdMixRow(index) {
  return `
    <div class="rtd-mix-row" data-row="${index}">
      <label class="rtd-mix-type"><span>原料类型</span><select name="type">${options(["茶叶", "添加剂", "配料"])}</select></label>
      <label class="rtd-mix-name"><span>原料名</span><input name="name" list="rtd-mix-tea-options" /></label>
      <label class="rtd-mix-amount"><span>添加量（每升）</span><input name="amount" /></label>
      <div class="rtd-mix-action">
        <button class="danger-button row-delete-button" data-remove-row type="button">删除</button>
      </div>
    </div>
  `;
}

function bindMaterialTabs() {
  document.querySelectorAll("[data-material-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      materialTab = button.dataset.materialTab;
      editing.materials = "";
      renderMaterials();
    });
  });
}

function bindFormulaTabs() {
  document.querySelectorAll("[data-formula-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      formulaTab = button.dataset.formulaTab;
      renderFormulas();
    });
  });
}

function bindMaterialForms() {
  const form = document.querySelector("form.form");
  if (!form) return;
  fillMaterialForm(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const current = findById(data.state.materials, editing.materials);
    const id = materialTab === "general" ? current?.id || uid("GEN") : clean(formData.get("id"));
    if (materialTab !== "general" && !id) return show(`${materialTab}-material-message`, "请填写编号。");
    if (!clean(formData.get("name"))) return show(`${materialTab}-material-message`, "请填写名称。");
    if (materialTab !== "general" && data.state.materials.some((item) => item.id === id && item.id !== editing.materials)) {
      return show(`${materialTab}-material-message`, "编号已存在。");
    }
    const record = {
      id,
      name: clean(formData.get("name")),
      group: materialTab,
      createdAt: current?.createdAt || today(),
    };
    if (materialTab === "tea") {
      Object.assign(record, {
        primaryCategory: clean(formData.get("primaryCategory")),
        secondaryCategory: clean(formData.get("secondaryCategory")),
        origin: clean(formData.get("origin")),
        style: clean(formData.get("style")),
        note: clean(formData.get("note")),
      });
    }
    if (materialTab === "additive") {
      Object.assign(record, {
        category: clean(formData.get("category")),
        secondaryCategory: clean(formData.get("secondaryCategory")),
        style: clean(formData.get("style")),
        note: clean(formData.get("note")),
      });
    }
    if (materialTab === "general") {
      Object.assign(record, {
        category: clean(formData.get("category")),
        secondaryCategory: clean(formData.get("secondaryCategory")),
        supplier: clean(formData.get("supplier")),
      });
    }
    upsert(data.state.materials, record, editing.materials);
    editing.materials = "";
    saveData();
    renderMaterials();
  });
  bindCancel("materials", renderMaterials);
}

function bindBlendForm() {
  const form = document.querySelector("#blend-form");
  fillBlendForm(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const current = findById(data.state.blends, editing.blends);
    const id = clean(formData.get("id"));
    const name = clean(formData.get("name"));
    const items = readBlendRows();
    if (!id) return show("blend-message", "请填写拼配编号。");
    if (!name) return show("blend-message", "请填写拼配名称。");
    if (data.state.blends.some((item) => item.id === id && item.id !== editing.blends)) return show("blend-message", "拼配编号已存在。");
    if (!items.length) return show("blend-message", "请至少录入一个原料。");
    upsert(
      data.state.blends,
      {
        id,
        name,
        customer: clean(formData.get("customer")),
        status: clean(formData.get("status")),
        method: clean(formData.get("method")),
        items,
        createdAt: current?.createdAt || today(),
      },
      editing.blends,
    );
    editing.blends = "";
    saveData();
    renderBlends();
  });
  bindDynamicRows("#blend-material-rows", "#add-blend-row", blendMaterialRow, "原料", updateBlendRow);
  document.querySelector("#blend-material-rows").addEventListener("change", (event) => {
    const row = event.target.closest(".blend-material-row");
    if (row) updateBlendRow(row);
  });
  updateAll("#blend-material-rows .blend-material-row", updateBlendRow);
  bindCancel("blends", renderBlends);
}

function bindFreshFormulaForm() {
  const form = document.querySelector("#fresh-formula-form");
  fillFreshFormulaForm(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const current = findById(data.state.freshFormulas, editing.freshFormulas);
    const name = clean(formData.get("name"));
    const brews = readBrews();
    const outputs = readOutputs();
    if (!name) return show("fresh-message", "请填写配方名称。");
    if (!brews.length) return show("fresh-message", "请至少填写一条茶叶冲泡。");
    if (!outputs.length) return show("fresh-message", "请至少填写一个饮品出品原料。");
    upsert(
      data.state.freshFormulas,
      {
        id: current?.id || uid("FRESH"),
        name,
        customer: clean(formData.get("customer")),
        status: clean(formData.get("status")),
        version: clean(formData.get("version")),
        brews,
        outputs,
        sop: clean(formData.get("sop")),
        createdAt: current?.createdAt || today(),
      },
      editing.freshFormulas,
    );
    editing.freshFormulas = "";
    saveData();
    renderFormulas();
  });
  bindDynamicRows("#brew-rows", "#add-brew-row", brewRow, "茶汤", updateSoupOptions);
  bindDynamicRows("#output-rows", "#add-output-row", outputRow, "原料", updateOutputRow);
  document.querySelector("#brew-rows").addEventListener("input", updateSoupOptions);
  document.querySelector("#output-rows").addEventListener("change", (event) => {
    const row = event.target.closest(".formula-material-row");
    if (row) updateOutputRow(row);
  });
  updateSoupOptions();
  updateAll("#output-rows .formula-material-row", updateOutputRow);
  bindCancel("freshFormulas", renderFormulas);
}

function bindRtdFormulaForm() {
  const form = document.querySelector("#rtd-formula-form");
  fillRtdFormulaForm(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const current = findById(data.state.rtdFormulas, editing.rtdFormulas);
    const name = clean(formData.get("name"));
    const teas = readRtdTeas();
    const mixItems = readRtdMix();
    if (!name) return show("rtd-message", "请填写配方名称。");
    if (!teas.length) return show("rtd-message", "请至少填写一款茶叶。");
    if (!mixItems.length) return show("rtd-message", "请至少填写一个调配原料。");
    upsert(
      data.state.rtdFormulas,
      {
        id: current?.id || uid("RTD"),
        name,
        customer: clean(formData.get("customer")),
        status: clean(formData.get("status")),
        version: clean(formData.get("version")),
        teas,
        extraction: {
          temperature: clean(formData.get("extractTemperature")),
          time: clean(formData.get("extractTime")),
          brewTeaWaterRatio: clean(formData.get("brewTeaWaterRatio")),
          finalTeaWaterRatio: clean(formData.get("finalTeaWaterRatio")),
        },
        mixItems,
        createdAt: current?.createdAt || today(),
      },
      editing.rtdFormulas,
    );
    editing.rtdFormulas = "";
    saveData();
    renderFormulas();
  });
  bindDynamicRows("#rtd-tea-rows", "#add-rtd-tea-row", rtdTeaRow, "茶叶");
  bindDynamicRows("#rtd-mix-rows", "#add-rtd-mix-row", rtdMixRow, "原料", updateRtdMixRow);
  document.querySelector("#rtd-mix-rows").addEventListener("change", (event) => {
    const row = event.target.closest(".rtd-mix-row");
    if (row) updateRtdMixRow(row);
  });
  updateAll("#rtd-mix-rows .rtd-mix-row", updateRtdMixRow);
  bindCancel("rtdFormulas", renderFormulas);
}

function bindCards(collection) {
  document.querySelectorAll(`[data-collection="${collection}"] [data-action]`).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.closest(".card").dataset.id;
      if (button.dataset.action === "edit") {
        editing[collection] = id;
        if (collection === "freshFormulas" || collection === "rtdFormulas") currentView = "formulas";
        render();
      }
      if (button.dataset.action === "delete") {
        const list = data.state[collection];
        const record = findById(list, id);
        if (record && window.confirm(`确定删除「${record.name}」吗？`)) {
          data.state[collection] = list.filter((item) => item.id !== id);
          saveData();
          render();
        }
      }
    });
  });
}

function fillMaterialForm(form) {
  const record = findById(data.state.materials, editing.materials);
  if (!record) return;
  setFormValue(form, "name", record.name);
  setFormValue(form, "id", record.id);
  ["primaryCategory", "secondaryCategory", "origin", "style", "note", "category", "supplier"].forEach((key) => setFormValue(form, key, record[key]));
}

function fillBlendForm(form) {
  const record = findById(data.state.blends, editing.blends);
  if (!record) return;
  ["id", "name", "customer", "status", "method"].forEach((key) => setFormValue(form, key, record[key]));
  const rows = document.querySelector("#blend-material-rows");
  rows.innerHTML = (record.items.length ? record.items : [{}]).map((_, index) => blendMaterialRow(index + 1)).join("");
  rows.querySelectorAll(".blend-material-row").forEach((row, index) => {
    const item = record.items[index] || {};
    row.querySelector('[name="type"]').value = item.type || "茶叶";
    row.querySelector('[name="amount"]').value = item.amount || "";
    row.querySelector('[name="name"]').value = item.name || "";
    row.querySelector('[name="materialId"]').value = item.materialId || "";
    updateBlendRow(row);
  });
}

function fillFreshFormulaForm(form) {
  const record = findById(data.state.freshFormulas, editing.freshFormulas);
  if (!record) return;
  ["name", "customer", "status", "version", "sop"].forEach((key) => setFormValue(form, key, record[key]));
  setRows("#brew-rows", record.brews, brewRow, (row, item) => {
    ["teaName", "teaId", "teaAmount", "temperature", "time", "hotWater", "ice"].forEach((key) => setRowValue(row, key, item[key]));
  });
  setRows("#output-rows", record.outputs, outputRow, (row, item) => {
    setRowValue(row, "type", item.type || "茶汤");
    setRowValue(row, "name", item.name);
    setRowValue(row, "amount", item.amount);
    updateOutputRow(row);
  });
}

function fillRtdFormulaForm(form) {
  const record = findById(data.state.rtdFormulas, editing.rtdFormulas);
  if (!record) return;
  ["name", "customer", "status", "version"].forEach((key) => setFormValue(form, key, record[key]));
  const ex = record.extraction || {};
  setFormValue(form, "extractTemperature", ex.temperature);
  setFormValue(form, "extractTime", ex.time);
  setFormValue(form, "brewTeaWaterRatio", ex.brewTeaWaterRatio);
  setFormValue(form, "finalTeaWaterRatio", ex.finalTeaWaterRatio);
  setRows("#rtd-tea-rows", record.teas, rtdTeaRow, (row, item) => {
    setRowValue(row, "teaName", item.name);
    setRowValue(row, "teaId", item.materialId);
  });
  setRows("#rtd-mix-rows", record.mixItems, rtdMixRow, (row, item) => {
    setRowValue(row, "type", item.type || "茶叶");
    setRowValue(row, "name", item.name);
    setRowValue(row, "amount", item.amount);
    updateRtdMixRow(row);
  });
}

function readBlendRows() {
  return [...document.querySelectorAll("#blend-material-rows .blend-material-row")]
    .map((row) => {
      const type = clean(row.querySelector('[name="type"]').value);
      const name = clean(row.querySelector('[name="name"]').value);
      const materialId = clean(row.querySelector('[name="materialId"]').value);
      const amount = clean(row.querySelector('[name="amount"]').value);
      if (!name && !materialId) return null;
      const source = type === "添加剂" ? materials("additive") : materials("tea");
      const matched = matchMaterial(source, name, materialId);
      return { type, name: matched?.name || name, materialId: matched?.id || materialId, amount };
    })
    .filter(Boolean);
}

function readBrews() {
  return [...document.querySelectorAll("#brew-rows .formula-brew-row")]
    .map((row) => {
      const teaName = clean(row.querySelector('[name="teaName"]').value);
      const teaId = clean(row.querySelector('[name="teaId"]').value);
      if (!teaName && !teaId) return null;
      const matched = matchMaterial([...materials("tea"), ...data.state.blends], teaName, teaId);
      const sourceName = matched?.name || teaName;
      return {
        soupName: sourceName ? `${sourceName}\u8336\u6c64` : "",
        teaName: sourceName,
        teaId: matched?.id || teaId,
        teaAmount: clean(row.querySelector('[name="teaAmount"]').value),
        temperature: clean(row.querySelector('[name="temperature"]').value),
        time: clean(row.querySelector('[name="time"]').value),
        hotWater: clean(row.querySelector('[name="hotWater"]').value),
        ice: clean(row.querySelector('[name="ice"]').value),
      };
    })
    .filter(Boolean);
}

function readOutputs() {
  return [...document.querySelectorAll("#output-rows .formula-material-row")]
    .map((row) => {
      const type = clean(row.querySelector('[name="type"]').value);
      const name = clean(row.querySelector('[name="name"]').value);
      const amount = clean(row.querySelector('[name="amount"]').value);
      if (!name && !amount) return null;
      const source = type === "茶汤" || type === "冰块" ? [] : materials("general").filter((item) => item.category === type);
      const matched = matchMaterial(source, name, "");
      return { type, name: matched?.name || name || type, amount };
    })
    .filter(Boolean);
}

function readRtdTeas() {
  return [...document.querySelectorAll("#rtd-tea-rows .rtd-tea-row")]
    .map((row) => {
      const name = clean(row.querySelector('[name="teaName"]').value);
      const materialId = clean(row.querySelector('[name="teaId"]').value);
      if (!name && !materialId) return null;
      const matched = matchMaterial(materials("tea"), name, materialId);
      return { name: matched?.name || name, materialId: matched?.id || materialId };
    })
    .filter(Boolean);
}

function readRtdMix() {
  return [...document.querySelectorAll("#rtd-mix-rows .rtd-mix-row")]
    .map((row) => {
      const type = clean(row.querySelector('[name="type"]').value);
      const name = clean(row.querySelector('[name="name"]').value);
      const amount = clean(row.querySelector('[name="amount"]').value);
      if (!name && !amount) return null;
      const source = type === "添加剂" ? materials("additive") : type === "配料" ? materials("general") : materials("tea");
      const matched = matchMaterial(source, name, "");
      return { type, name: matched?.name || name, materialId: matched?.id || "", amount };
    })
    .filter(Boolean);
}

function updateBlendRow(row) {
  const type = row.querySelector('[name="type"]').value;
  row.querySelector('[name="name"]').setAttribute("list", type === "添加剂" ? "blend-additive-name-options" : "blend-tea-name-options");
  row.querySelector('[name="materialId"]').setAttribute("list", type === "添加剂" ? "blend-additive-id-options" : "blend-tea-id-options");
}

function updateSoupOptions() {
  const list = document.querySelector("#fresh-output-soup-options");
  if (!list) return;
  list.innerHTML = currentSoupNames().map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
}

function updateOutputRow(row) {
  const type = row.querySelector('[name="type"]').value;
  const input = row.querySelector('[name="name"]');
  if (type === "茶汤") input.setAttribute("list", "fresh-output-soup-options");
  else if (type === "冰块") {
    input.removeAttribute("list");
    if (!input.value) input.value = "冰块";
  } else input.setAttribute("list", datalistId("fresh-general", type));
}

function updateRtdMixRow(row) {
  const type = row.querySelector('[name="type"]').value;
  const input = row.querySelector('[name="name"]');
  input.setAttribute("list", type === "添加剂" ? "rtd-mix-additive-options" : type === "配料" ? "rtd-mix-general-options" : "rtd-mix-tea-options");
}

function bindDynamicRows(containerSelector, addButtonSelector, renderer, label, afterChange = () => {}) {
  const container = document.querySelector(containerSelector);
  document.querySelector(addButtonSelector).addEventListener("click", () => {
    const nextIndex = container.children.length + 1;
    container.insertAdjacentHTML("beforeend", renderer(nextIndex));
    afterChange(container.lastElementChild);
  });
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-row]");
    if (!button) return;
    if (container.children.length <= 1) return;
    button.closest("[data-row]").remove();
    [...container.children].forEach((row, index) => {
      row.querySelector(".row-index").textContent = `${label} ${index + 1}`;
    });
    afterChange();
  });
}

function bindCancel(collection, callback) {
  const button = document.querySelector(`[data-cancel="${collection}"]`);
  if (!button) return;
  button.addEventListener("click", () => {
    editing[collection] = "";
    callback();
  });
}

function materialCard(record) {
  if (record.group === "tea") {
    return baseCard("materials", record, record.primaryCategory, [record.secondaryCategory, record.origin], [
      ["风格", record.style || "未填写"],
      ["备注", record.note || "未填写"],
    ]);
  }
  if (record.group === "additive") {
    return baseCard("materials", record, record.category, [record.secondaryCategory], [
      ["风格", record.style || "未填写"],
      ["备注", record.note || "未填写"],
    ]);
  }
  return baseCard("materials", record, record.category, [record.supplier], [
    ["供应商", record.supplier || "未填写"],
    ["二级分类", record.secondaryCategory || "未填写"],
  ]);
}

function blendCard(record) {
  return baseCard("blends", record, record.customer || "未填写客户", [record.status, `${record.items.length} 个原料`], [
    ["原料", record.items.map((item) => `${item.name}${item.materialId ? `（${item.materialId}）` : ""}${item.amount ? ` ${item.amount}%` : ""}`).join(" / ")],
    ["拼配方式", record.method || "未填写"],
  ]);
}

function freshFormulaCard(record) {
  return baseCard("freshFormulas", record, record.customer || "未填写客户", [record.status, record.version, `${record.outputs.length} 个出品原料`], [
    ["茶叶冲泡", record.brews.map((item) => `${item.soupName || item.teaName}${item.teaId ? `（${item.teaId}）` : ""}`).join(" / ")],
    ["饮品出品", record.outputs.map((item) => `${item.name}${item.amount ? ` ${item.amount}` : ""}`).join(" / ")],
    ["SOP", record.sop || "未填写"],
  ]);
}

function rtdFormulaCard(record) {
  const ex = record.extraction || {};
  return baseCard("rtdFormulas", record, record.customer || "未填写客户", [record.status, record.version, `${record.mixItems.length} 个调配原料`], [
    ["茶汤萃取", record.teas.map((item) => `${item.name}${item.materialId ? `（${item.materialId}）` : ""}`).join(" / ")],
    ["萃取参数", [ex.temperature, ex.time, ex.brewTeaWaterRatio, ex.finalTeaWaterRatio].filter(Boolean).join(" / ") || "未填写"],
    ["调配方案", record.mixItems.map((item) => `${item.type}:${item.name}${item.amount ? ` ${item.amount}` : ""}`).join(" / ")],
  ]);
}

function baseCard(collection, record, meta, tags, rows) {
  return `
    <article class="card" data-collection="${collection}" data-id="${esc(record.id)}">
      <div class="card-head">
        <div>
          <p class="code">${collection !== "freshFormulas" && collection !== "rtdFormulas" && !(collection === "materials" && record.group === "general") ? `编号：${esc(record.id)} · ` : ""}${esc(meta || "")}</p>
          <h2 class="card-title">${esc(record.name)}</h2>
        </div>
      </div>
      <div class="meta-row"><span>${esc(record.createdAt || "")}</span></div>
      <div class="tag-row">${tags.filter(Boolean).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
      <ul class="summary-list">${rows.map(([key, value]) => `<li><span>${esc(key)}</span><strong>${esc(value)}</strong></li>`).join("")}</ul>
      <div class="card-actions">
        <button class="ghost-button small-button" type="button" data-action="edit">编辑</button>
        <button class="danger-button" type="button" data-action="delete">删除</button>
      </div>
    </article>
  `;
}

function library(collection, records, renderer, heading, hint) {
  return `
    <section class="library library-simple">
      <div class="result-head">
        <div>
          <h2>${esc(heading)}</h2>
          <p class="hint">${esc(hint)}</p>
        </div>
      </div>
      <div class="card-grid">${records.length ? records.map(renderer).join("") : '<div class="empty-state">暂无数据</div>'}</div>
    </section>
  `;
}

function blendDatalists() {
  return `
    ${datalist("blend-tea-name-options", materials("tea"), "name", "id")}
    ${datalist("blend-tea-id-options", materials("tea"), "id", "name")}
    ${datalist("blend-additive-name-options", materials("additive"), "name", "id")}
    ${datalist("blend-additive-id-options", materials("additive"), "id", "name")}
  `;
}

function formulaTeaDatalists() {
  const source = [...materials("tea"), ...data.state.blends];
  return `${datalist("formula-tea-name-options", source, "name", "id")}${datalist("formula-tea-id-options", source, "id", "name")}`;
}

function freshOutputDatalists() {
  return `
    <datalist id="fresh-output-soup-options"></datalist>
    ${data.settings.generalCategories
      .map((category) => datalist(datalistId("fresh-general", category), materials("general").filter((item) => item.category === category), "name", "supplier"))
      .join("")}
  `;
}

function rtdTeaDatalists() {
  return `${datalist("rtd-tea-name-options", materials("tea"), "name", "id")}${datalist("rtd-tea-id-options", materials("tea"), "id", "name")}`;
}

function rtdMixDatalists() {
  return `
    ${datalist("rtd-mix-tea-options", materials("tea"), "name", "id")}
    ${datalist("rtd-mix-additive-options", materials("additive"), "name", "id")}
    ${datalist("rtd-mix-general-options", materials("general"), "name", "category")}
  `;
}

function datalist(id, items, valueKey, labelKey) {
  return `<datalist id="${id}">${items.map((item) => `<option value="${esc(item[valueKey] || "")}">${esc(item[labelKey] || "")}</option>`).join("")}</datalist>`;
}

function settingsBox(name, label, values) {
  return `
    <section class="settings-card">
      <label><span>${esc(label)}</span><textarea name="${name}">${esc(values.join("\n"))}</textarea></label>
      <p class="hint">每行一个选项。</p>
    </section>
  `;
}

function formActions(messageId, buttonText, collection) {
  return `
    <div class="button-row">
      <p id="${messageId}" class="form-message"></p>
      <div class="form-actions">
        <button class="ghost-button" data-cancel="${collection}" type="button" ${editing[collection] ? "" : "hidden"}>取消修改</button>
        <button class="primary-button" type="submit">${editing[collection] ? "保存修改" : buttonText}</button>
      </div>
    </div>
  `;
}

function freshOutputTypes() {
  return ["茶汤", ...data.settings.generalCategories, "冰块"];
}

function currentSoupNames() {
  return [...document.querySelectorAll("#brew-rows .formula-brew-row")].map((row, index) => {
    const teaName = clean(row.querySelector('[name="teaName"]').value);
    return teaName ? `${teaName}茶汤` : `茶汤 ${index + 1}`;
  });
}

function materials(group) {
  return data.state.materials.filter((item) => item.group === group);
}

function filterRecords(records) {
  const keyword = clean(searchInput.value).toLowerCase();
  if (!keyword) return records;
  return records.filter((record) => JSON.stringify(record).toLowerCase().includes(keyword));
}

function matchMaterial(source, name, id) {
  return (
    source.find((item) => id && item.id === id) ||
    source.find((item) => name && item.name === name) ||
    source.find((item) => id && item.id?.includes(id)) ||
    source.find((item) => name && item.name?.includes(name))
  );
}

function setRows(selector, items, renderer, fill) {
  const container = document.querySelector(selector);
  const safeItems = items?.length ? items : [{}];
  container.innerHTML = safeItems.map((_, index) => renderer(index + 1)).join("");
  [...container.children].forEach((row, index) => fill(row, safeItems[index] || {}));
}

function updateAll(selector, callback) {
  document.querySelectorAll(selector).forEach(callback);
}

function upsert(list, record, oldId) {
  const index = list.findIndex((item) => item.id === oldId);
  if (index >= 0) list[index] = record;
  else list.unshift(record);
}

function findById(list, id) {
  return list.find((item) => item.id === id);
}

function setFormValue(form, key, value) {
  if (form.elements[key]) form.elements[key].value = value || "";
}

function setRowValue(row, key, value) {
  const input = row.querySelector(`[name="${key}"]`);
  if (input) input.value = value || "";
}

function options(values, selected = values[0]) {
  return values.map((value) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`).join("");
}

function datalistId(prefix, value) {
  return `${prefix}-${encodeURIComponent(value)}`;
}

function show(id, message) {
  const target = document.querySelector(`#${id}`);
  if (target) target.textContent = message;
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function clean(value) {
  return String(value || "").trim();
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeData(value = {}) {
  const saved = value || {};
  return {
    settings: { ...clone(defaults.settings), ...(saved.settings || {}) },
    state: normalizeState(saved.state || {}),
  };
}

function normalizeState(value = {}) {
  return {
    ...clone(defaults.state),
    ...value,
    materials: normalizeMaterials(value.materials || defaults.state.materials),
    blends: normalizeBlends(value.blends || []),
    freshFormulas: normalizeFreshFormulas(value.freshFormulas || value.formulas || []),
    rtdFormulas: normalizeRtdFormulas(value.rtdFormulas || []),
  };
}

function normalizeMaterials(items) {
  return (items || []).map((item) => {
    const group = item.group || item.materialGroup || (item.category === "茶叶" ? "tea" : item.category === "添加剂" || item.category === "香原料" ? "additive" : "general");
    if (group === "tea") {
      return {
        id: item.id || uid("T"),
        name: item.name || "",
        group: "tea",
        primaryCategory: item.primaryCategory || item.category || "其他代用茶",
        secondaryCategory: item.secondaryCategory || "",
        origin: item.origin || "",
        style: item.style || "",
        note: item.note || "",
        createdAt: item.createdAt || today(),
      };
    }
    if (group === "additive") {
      return {
        id: item.id || uid("A"),
        name: item.name || "",
        group: "additive",
        category: item.category || "其他",
        secondaryCategory: item.secondaryCategory || "",
        style: item.style || "",
        note: item.note || "",
        createdAt: item.createdAt || today(),
      };
    }
    return {
      id: item.id || uid("GEN"),
      name: item.name || "",
      group: "general",
      category: item.category || item.generalCategory || "其他",
      secondaryCategory: item.secondaryCategory || "",
      supplier: item.supplier || "",
      createdAt: item.createdAt || today(),
    };
  });
}

function normalizeBlends(items) {
  return (items || []).map((item) => ({
    id: item.id || uid("BLD"),
    name: item.name || "",
    customer: item.customer || "",
    status: item.status || "",
    method: item.method || "",
    items: (item.items || []).map((row) => ({
      type: row.type || row.materialType || "茶叶",
      name: row.name || "",
      materialId: row.materialId || "",
      amount: row.amount || row.ratio || "",
    })),
    createdAt: item.createdAt || today(),
  }));
}

function normalizeFreshFormulas(items) {
  return (items || []).map((item) => {
    const brews = item.brews || (item.brew ? [item.brew] : []);
    const outputs = item.outputs || item.drinkItems || item.items || item.manualItems || [];
    return {
      id: item.id || uid("FRESH"),
      name: item.name || "",
      customer: item.customer || "",
      status: item.status || "",
      version: item.version || "",
      brews: brews.map((brew) => ({
        soupName: brew.soupName || (brew.name ? `${brew.name}茶汤` : ""),
        teaName: brew.teaName || brew.name || "",
        teaId: brew.teaId || brew.materialId || "",
        teaAmount: brew.teaAmount || "",
        temperature: brew.temperature || "",
        time: brew.time || "",
        hotWater: brew.hotWater || "",
        ice: brew.ice || "",
      })),
      outputs: outputs.map((row) => ({
        type: row.type || row.materialType || "茶汤",
        name: row.name || "",
        amount: row.amount || row.ratio || "",
      })),
      sop: item.sop || item.note || "",
      createdAt: item.createdAt || today(),
    };
  });
}

function normalizeRtdFormulas(items) {
  return (items || []).map((item) => ({
    id: item.id || uid("RTD"),
    name: item.name || "",
    customer: item.customer || "",
    status: item.status || "",
    version: item.version || "",
    teas: item.teas || [],
    extraction: item.extraction || {},
    mixItems: item.mixItems || [],
    createdAt: item.createdAt || today(),
  }));
}

function loadData() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
  } catch {
    return normalizeData(clone(defaults));
  }
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  if (API_ENABLED) {
    saveRemoteData("settings", data.settings);
    saveRemoteData("state", data.state);
  }
}

async function initApp() {
  render();
  if (!API_ENABLED) return;
  const [remoteSettings, remoteState] = await Promise.all([
    loadRemoteData("settings"),
    loadRemoteData("state"),
  ]);
  const hasRemoteSettings = !isEmptyObject(remoteSettings);
  const hasRemoteState = !isEmptyObject(remoteState);
  if (hasRemoteSettings || hasRemoteState) {
    data = normalizeData({
      settings: hasRemoteSettings ? remoteSettings : data.settings,
      state: hasRemoteState ? remoteState : data.state,
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    render();
  }
  if (!hasRemoteSettings) saveRemoteData("settings", data.settings);
  if (!hasRemoteState) saveRemoteData("state", data.state);
}

async function loadRemoteData(key) {
  try {
    const response = await fetch(`/api/${key}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Remote ${key} load failed`, error);
    return {};
  }
}

async function saveRemoteData(key, value) {
  try {
    const response = await fetch(`/api/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn(`Remote ${key} save failed`, error);
  }
}

function isEmptyObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}
