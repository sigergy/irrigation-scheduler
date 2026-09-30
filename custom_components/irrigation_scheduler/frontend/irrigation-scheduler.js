//#region node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, ee = globalThis, te = ee.trustedTypes, ne = te ? te.emptyScript : "", re = ee.reactiveElementPolyfillSupport, h = (e, t) => e, ie = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ne : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, ae = (e, t) => !l(e, t), oe = {
	attribute: !0,
	type: String,
	converter: ie,
	reflect: !1,
	useDefault: !1,
	hasChanged: ae
};
Symbol.metadata ??= Symbol("metadata"), ee.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var g = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = oe) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? oe;
	}
	static _$Ei() {
		if (this.hasOwnProperty(h("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(h("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(h("properties"))) {
			let e = this.properties, t = [...f(e), ...p(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? ie : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? ie : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ae)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
g.elementStyles = [], g.shadowRootOptions = { mode: "open" }, g[h("elementProperties")] = /* @__PURE__ */ new Map(), g[h("finalized")] = /* @__PURE__ */ new Map(), re?.({ ReactiveElement: g }), (ee.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var se = globalThis, ce = (e) => e, le = se.trustedTypes, ue = le ? le.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, de = "$lit$", _ = `lit$${Math.random().toFixed(9).slice(2)}$`, fe = "?" + _, pe = `<${fe}>`, v = document, y = () => v.createComment(""), me = (e) => e === null || typeof e != "object" && typeof e != "function", he = Array.isArray, ge = (e) => he(e) || typeof e?.[Symbol.iterator] == "function", _e = "[ 	\n\f\r]", b = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ve = /-->/g, ye = />/g, x = RegExp(`>|${_e}(?:([^\\s"'>=/]+)(${_e}*=${_e}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), be = /'/g, xe = /"/g, Se = /^(?:script|style|textarea|title)$/i, Ce = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), S = Ce(1), we = Ce(2), C = Symbol.for("lit-noChange"), w = Symbol.for("lit-nothing"), Te = /* @__PURE__ */ new WeakMap(), T = v.createTreeWalker(v, 129);
function Ee(e, t) {
	if (!he(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ue === void 0 ? t : ue.createHTML(t);
}
var De = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = b;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === b ? c[1] === "!--" ? o = ve : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = x) : (Se.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = x) : o = ye : o === x ? c[0] === ">" ? (o = i ?? b, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? x : c[3] === "\"" ? xe : be) : o === xe || o === be ? o = x : o === ve || o === ye ? o = b : (o = x, i = void 0);
		let d = o === x && e[t + 1].startsWith("/>") ? " " : "";
		a += o === b ? n + pe : l >= 0 ? (r.push(s), n.slice(0, l) + de + n.slice(l) + _ + d) : n + _ + (l === -2 ? t : d);
	}
	return [Ee(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Oe = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = De(t, n);
		if (this.el = e.createElement(l, r), T.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = T.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(de)) {
					let t = u[o++], n = i.getAttribute(e).split(_), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? je : r[1] === "?" ? Me : r[1] === "@" ? Ne : D
					}), i.removeAttribute(e);
				} else e.startsWith(_) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (Se.test(i.tagName)) {
					let e = i.textContent.split(_), t = e.length - 1;
					if (t > 0) {
						i.textContent = le ? le.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], y()), T.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], y());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === fe) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(_, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += _.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = v.createElement("template");
		return n.innerHTML = e, n;
	}
};
function E(e, t, n = e, r) {
	if (t === C) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = me(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = E(e, i._$AS(e, t.values), i, r)), t;
}
var ke = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? v).importNode(t, !0);
		T.currentNode = r;
		let i = T.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Ae(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Pe(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = T.nextNode(), a++);
		}
		return T.currentNode = v, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Ae = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = w, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = E(this, e, t), me(e) ? e === w || e == null || e === "" ? (this._$AH !== w && this._$AR(), this._$AH = w) : e !== this._$AH && e !== C && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ge(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== w && me(this._$AH) ? this._$AA.nextSibling.data = e : this.T(v.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Oe.createElement(Ee(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new ke(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = Te.get(e.strings);
		return t === void 0 && Te.set(e.strings, t = new Oe(e)), t;
	}
	k(t) {
		he(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(y()), this.O(y()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ce(e).nextSibling;
			ce(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, D = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = w, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = w;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = E(this, e, t, 0), a = !me(e) || e !== this._$AH && e !== C, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = E(this, r[n + o], t, o), s === C && (s = this._$AH[o]), a ||= !me(s) || s !== this._$AH[o], s === w ? e = w : e !== w && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === w ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, je = class extends D {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === w ? void 0 : e;
	}
}, Me = class extends D {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== w);
	}
}, Ne = class extends D {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = E(this, e, t, 0) ?? w) === C) return;
		let n = this._$AH, r = e === w && n !== w || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== w && (n === w || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Pe = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		E(this, e);
	}
}, Fe = {
	M: de,
	P: _,
	A: fe,
	C: 1,
	L: De,
	R: ke,
	D: ge,
	V: E,
	I: Ae,
	H: D,
	N: Me,
	U: Ne,
	B: je,
	F: Pe
}, Ie = se.litHtmlPolyfillSupport;
Ie?.(Oe, Ae), (se.litHtmlVersions ??= []).push("3.3.3");
var Le = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Ae(t.insertBefore(y(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Re = globalThis, O = class extends g {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Le(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return C;
	}
};
O._$litElement$ = !0, O.finalized = !0, Re.litElementHydrateSupport?.({ LitElement: O });
var ze = Re.litElementPolyfillSupport;
ze?.({ LitElement: O }), (Re.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var k = "irrigation_scheduler", Be = `${k}/subscribe`, Ve = (e) => e.callWS({ type: `${k}/list` });
function He(e, t) {
	let n = {
		zone_id: t.zone_id ?? null,
		name: t.name,
		enabled: t.enabled,
		mode: t.mode,
		days: t.days,
		start_times: t.start_times,
		max_simultaneous: t.max_simultaneous,
		rain_skip: t.rain_skip,
		sensors: t.sensors,
		calc_method: t.calc_method,
		valves: t.valves.map((e) => ({
			entity_id: e.entity_id,
			name: e.name,
			duration_min: e.duration_min,
			start_times: e.start_times,
			enabled: e.enabled
		}))
	};
	return e.callWS({
		type: `${k}/save_zone`,
		zone: n
	});
}
var Ue = (e, t) => e.callWS({
	type: `${k}/delete_zone`,
	zone_id: t
});
function We(e, t) {
	let n = {
		global_max_valves: t.global_max_valves,
		notify_targets: t.notify_targets,
		rain_sensor: t.rain_sensor,
		rain_past_hours: t.rain_past_hours,
		rain_past_threshold_mm: t.rain_past_threshold_mm,
		weather_entity: t.weather_entity,
		rain_forecast_hours: t.rain_forecast_hours,
		rain_forecast_threshold_mm: t.rain_forecast_threshold_mm,
		alerts: t.alerts
	};
	return e.callWS({
		type: `${k}/save_settings`,
		settings: n
	});
}
var Ge = (e, t) => e.callWS({
	type: `${k}/run_zone`,
	zone_id: t
}), Ke = (e, t) => e.callWS({
	type: `${k}/run_valve`,
	entity_id: t
}), qe = (e, t) => e.callWS({
	type: `${k}/stop`,
	...t ? { zone_id: t } : {}
}), Je = (e, t) => e.callWS({
	type: `${k}/pause_valve`,
	entity_id: t
}), Ye = (e, t, n) => e.callWS({
	type: `${k}/set_valve_enabled`,
	entity_id: t,
	enabled: n
}), Xe = (e, t, n) => e.callWS({
	type: `${k}/set_zone_enabled`,
	zone_id: t,
	enabled: n
}), Ze = (e, t, n, r) => e.callWS({
	type: "history/history_during_period",
	entity_ids: t,
	start_time: new Date(n).toISOString(),
	end_time: new Date(r).toISOString(),
	minimal_response: !0,
	no_attributes: !0
}), Qe = (e, t, n, r) => e.callWS({
	type: "history/history_during_period",
	entity_ids: t,
	start_time: new Date(n).toISOString(),
	end_time: new Date(r).toISOString(),
	include_start_time_state: !1,
	significant_changes_only: !1
}), $e = {
	title: "Riego",
	tab_zones: "Zonas",
	tab_settings: "Ajustes",
	pause_all: "Pausar todo",
	status_running: "Regando",
	status_queued: "En cola",
	status_idle: "Programada",
	status_stopped: "Detenida",
	status_manual: "Regando (manual)",
	action_run: "Regar",
	action_resume: "Reactivar",
	action_pause: "Pausar",
	action_stop: "Detener",
	zone_run: "Regar zona",
	zone_resume: "Reactivar zona",
	zone_pause: "Pausar zona",
	zone_stop: "Detener zona",
	disconnected: "Sin conexión con HA",
	not_loaded: "Irrigation Scheduler no está configurado",
	load_error: "No se ha podido cargar el estado del riego. Se reintenta cada 30 s.",
	loading: "Cargando…",
	command_failed: "No se ha podido ejecutar la orden",
	every_day: "Todos los días",
	no_times: "Sin horas",
	valves_one: "1 válvula",
	valves_count: "{n} válvulas",
	today: "Hoy {time}",
	tomorrow: "Mañana {time}",
	remaining: "quedan {time}",
	batch: "Lote",
	minutes_short: "{n} min",
	add_zone: "＋ Zona",
	configure_zone: "Configurar zona",
	empty_list: "Aún no hay zonas.",
	zone_not_found: "Zona no encontrada",
	new_zone: "Zona nueva",
	back: "Volver",
	cancel: "Cancelar",
	confirm_remove: "Quitar",
	confirm_delete_action: "Borrar",
	confirm_leave_action: "Salir",
	confirm_discard_action: "Descartar",
	save: "Guardar",
	delete_zone: "Borrar zona",
	confirm_leave: "Hay cambios sin guardar. ¿Salir sin guardar?",
	confirm_delete: "¿Borrar la zona «{name}»? Se apagan sus válvulas abiertas.",
	confirm_discard_settings: "Hay cambios sin guardar en Ajustes. ¿Descartarlos?",
	saved: "Zona guardada",
	not_saved: "No se ha guardado: revisa los campos marcados.",
	external_change: "Esta zona ha cambiado fuera del editor.",
	reload: "Recargar",
	zone_deleted: "La zona se ha borrado.",
	dialog_ok: "Aceptar",
	delete_valves_not_off: "No se ha borrado la zona: {valves} no se ha apagado. Revísala y vuelve a intentarlo.",
	delete_zone_busy: "No se ha borrado la zona: {valves} se está abriendo o cerrando. Vuelve a intentarlo en unos segundos.",
	field_name: "Nombre",
	rain: "Lluvia",
	rain_skip: "Omitir por lluvia",
	rain_skip_help: "Si llueve lo configurado en Ajustes › Lluvia, esta zona no riega en sus bloques.",
	mode: "Modo",
	mode_manual: "Manual",
	mode_auto: "Auto",
	auto_help: "Auto requiere un método de cálculo (fase 6).",
	days: "Días",
	start_times: "Bloques de inicio",
	add_time: "＋ Hora",
	max_simultaneous: "Válvulas a la vez en la zona",
	next_run: "Próximo riego: {when}",
	valves: "Válvulas",
	queue_order: "el orden es el orden de cola",
	add_valve: "＋ Añadir",
	col_name: "Nombre",
	col_entity: "Entidad",
	col_minutes: "Minutos",
	col_blocks: "Bloques",
	col_status: "Estado",
	valve_name: "Nombre",
	valve_minutes: "Min",
	manual_only: "Solo manual",
	add_times_first: "Añade horas a la zona",
	remove_valve: "Quitar válvula",
	new_valve: "sin nombre",
	confirm_remove_valve: "¿Quitar la válvula «{name}» de la zona? El cambio se aplica al guardar.",
	drag: "Arrastrar para ordenar",
	picker_help: "El selector de switch oculta las ya usadas en cualquier zona.",
	status_after_save: "Estado y botones ▶ ⏸ ■ aparecen tras el primer guardado.",
	no_valves: "Sin válvulas.",
	rule_name: "Pon un nombre",
	rule_V1: "Elige una entidad switch",
	rule_V2: "Al menos 1 minuto",
	rule_V3: "Bloque que no es de la zona",
	rule_V4: "Elige al menos un día",
	rule_V5: "Añade al menos una hora de inicio",
	rule_V6: "Hora repetida",
	rule_V7: "Esta switch ya está en otra válvula",
	rule_V8: "Auto requiere un método de cálculo",
	rule_V9: "Debe ser 1 o más",
	rule_V12: "Pon un nombre a la válvula",
	rule_time: "Hora no válida",
	rule_entity: "Entidad no válida",
	rule_notify: "Destino no válido",
	rule_hours_24: "Entre 1 y 24",
	rule_hours_6_24: "Entre 6 y 24",
	rule_positive: "Debe ser mayor que 0",
	rule_unknown: "Valor no válido",
	concurrency: "Simultaneidad",
	limit_global: "Limitar válvulas abiertas en toda la instalación",
	global_max: "Máximo global",
	global_off_help: "Desactivado = sin límite global.",
	notifications: "Notificaciones",
	notifications_help: "Móviles que reciben los push. Pulsa uno para activarlo o quitarlo. Cada alerta elige cuáles en «Errores y avisos».",
	no_targets: "No hay dispositivos móviles con la app de HA.",
	alerts: "Errores y avisos",
	alerts_help: "Qué alertas llegan al móvil y cuáles salen en el histórico. Todas quedan siempre registradas en HA.",
	alerts_no_targets: "No hay móviles en Notificaciones: activa alguno para recibir push.",
	level_valve: "Válvula",
	level_zone: "Zona",
	level_installation: "Instalación",
	alert_push: "Push",
	alert_priority: "Prioridad",
	alert_history: "Histórico",
	alert_details: "Más opciones",
	alert_all_targets: "Todos",
	priority_critical: "Crítica",
	priority_high: "Alta",
	priority_normal: "Normal",
	alert_turn_on_failed: "La válvula no enciende",
	alert_turn_on_failed_help: "No responde al encender tras 3 reintentos. Se descarta y la cola sigue.",
	alert_turn_off_failed: "La válvula no apaga",
	alert_turn_off_failed_help: "No responde al apagar tras 3 reintentos: puede seguir regando. Prioridad mínima: alta.",
	alert_overrun_restart: "Tiempo excedido con HA parado",
	alert_overrun_restart_help: "Al arrancar HA, una válvula había pasado su tiempo. Se apaga.",
	alert_overrun_running: "Tiempo excedido",
	alert_overrun_running_help: "Seguía abierta pasado su tiempo. La apaga la vigilancia cada 5 min.",
	alert_manual_overrun: "Encendida a mano demasiado tiempo",
	alert_manual_overrun_help: "Encendida fuera del riego más de su duración. La apaga la vigilancia cada 5 min.",
	alert_sensor_unavailable: "Sensor no disponible",
	alert_sensor_unavailable_help: "Un sensor de la zona pasa a no disponible o desconocido.",
	alert_rain_skipped: "Riego omitido por lluvia",
	alert_rain_skipped_help: "Un bloque de la zona no riega por lluvia. Un push al empezar a omitir por lluvia en la zona.",
	alert_rain_source_unavailable: "Fuente de lluvia no disponible",
	alert_rain_source_unavailable_help: "El pluviómetro o el pronóstico no dan datos al decidir. Se riega.",
	alert_valve_switched: "Válvula encendida/apagada",
	alert_valve_switched_help: "Un push al encender y otro al apagar, con el tiempo abierta. Programado, manual o externo. No se marca en el histórico.",
	rule_alert: "Alerta desconocida",
	rule_alert_priority: "Prioridad no permitida en esta alerta",
	rain_help: "Solo en las zonas con «Omitir por lluvia». Un bloque no riega si se cumple cualquiera de las dos condiciones. La orden manual siempre riega.",
	rain_past: "Lluvia ya caída",
	rain_sensor: "Pluviómetro: sensor de lluvia acumulada o de intensidad (opcional)",
	rain_past_hours: "Mirar las últimas… (horas, 1–24)",
	rain_past_threshold: "No regar si han caído al menos…",
	rain_past_rule: "No riega si han caído {amount} {unit} o más en las últimas {hours} horas.",
	rain_forecast: "Lluvia prevista",
	weather_entity: "Previsión: entidad weather (opcional)",
	weather_no_hourly: "Esta entidad no da pronóstico por horas: la lluvia prevista no funcionará.",
	rain_forecast_hours: "Mirar las próximas… (horas, 6–24)",
	rain_forecast_threshold: "No regar si se prevén al menos…",
	rain_forecast_rule: "No riega si se prevén {amount} {unit} o más en las próximas {hours} horas.",
	settings_saved: "Ajustes guardados",
	settings_not_saved: "No se han guardado los ajustes: revisa los campos marcados.",
	card_description: "Estado y control de las zonas de riego.",
	card_bad_zones: "«zones» debe ser una lista de IDs de zona.",
	card_all_zones: "Sin zonas elegidas, la tarjeta muestra todas.",
	card_zones: "Zonas",
	card_order_help: "El orden de los chips es el orden en la tarjeta.",
	card_title: "Título (opcional)",
	history_description: "Encendidos reales de las válvulas por zona.",
	history_view_timeline: "Línea de tiempo",
	history_view_totals: "Totales",
	history_hours: "{n} h",
	history_days: "{n} d",
	history_custom: "Otra…",
	history_range: "Rango…",
	history_unit_hours: "horas",
	history_unit_days: "días",
	history_from: "Desde",
	history_to: "Hasta",
	history_empty: "Sin riegos en la ventana",
	history_unavailable: "Histórico no disponible",
	history_ongoing: "en curso",
	history_runs_one: "1 encendido",
	history_runs: "{n} encendidos",
	history_card_view: "Vista inicial",
	history_card_window: "Ventana inicial",
	history_card_help: "Datos del recorder de HA. Las switch excluidas del recorder aparecen sin riegos.",
	history_run: "Riego",
	history_run_scheduled: "Riego programado",
	history_run_manual: "Riego manual",
	history_run_external: "Riego externo",
	history_watered: "Tiempo regado: {time}",
	history_before_window: "Desde antes de la ventana",
	history_installation: "Instalación"
}, et = {
	title: "Irrigation",
	tab_zones: "Zones",
	tab_settings: "Settings",
	pause_all: "Pause all",
	status_running: "Watering",
	status_queued: "Queued",
	status_idle: "Scheduled",
	status_stopped: "Stopped",
	status_manual: "Watering (manual)",
	action_run: "Water",
	action_resume: "Re-enable",
	action_pause: "Pause",
	action_stop: "Stop",
	zone_run: "Water zone",
	zone_resume: "Re-enable zone",
	zone_pause: "Pause zone",
	zone_stop: "Stop zone",
	disconnected: "No connection to HA",
	not_loaded: "Irrigation Scheduler is not configured",
	load_error: "Could not load the irrigation state. Retrying every 30 s.",
	loading: "Loading…",
	command_failed: "The command could not be run",
	every_day: "Every day",
	no_times: "No times",
	valves_one: "1 valve",
	valves_count: "{n} valves",
	today: "Today {time}",
	tomorrow: "Tomorrow {time}",
	remaining: "{time} left",
	batch: "Batch",
	minutes_short: "{n} min",
	add_zone: "＋ Zone",
	configure_zone: "Configure zone",
	empty_list: "No zones yet.",
	zone_not_found: "Zone not found",
	new_zone: "New zone",
	back: "Back",
	cancel: "Cancel",
	confirm_remove: "Remove",
	confirm_delete_action: "Delete",
	confirm_leave_action: "Leave",
	confirm_discard_action: "Discard",
	save: "Save",
	delete_zone: "Delete zone",
	confirm_leave: "There are unsaved changes. Leave without saving?",
	confirm_delete: "Delete zone «{name}»? Its open valves are turned off.",
	confirm_discard_settings: "There are unsaved changes in Settings. Discard them?",
	saved: "Zone saved",
	not_saved: "Not saved: check the highlighted fields.",
	external_change: "This zone changed outside the editor.",
	reload: "Reload",
	zone_deleted: "The zone was deleted.",
	dialog_ok: "OK",
	delete_valves_not_off: "The zone was not deleted: {valves} did not turn off. Check it and try again.",
	delete_zone_busy: "The zone was not deleted: {valves} is opening or closing. Try again in a few seconds.",
	field_name: "Name",
	rain: "Rain",
	rain_skip: "Skip on rain",
	rain_skip_help: "If it rains as configured in Settings › Rain, this zone does not water in its blocks.",
	mode: "Mode",
	mode_manual: "Manual",
	mode_auto: "Auto",
	auto_help: "Auto requires a calculation method (phase 6).",
	days: "Days",
	start_times: "Start blocks",
	add_time: "＋ Time",
	max_simultaneous: "Valves at once in the zone",
	next_run: "Next run: {when}",
	valves: "Valves",
	queue_order: "order is queue order",
	add_valve: "＋ Add",
	col_name: "Name",
	col_entity: "Entity",
	col_minutes: "Minutes",
	col_blocks: "Blocks",
	col_status: "Status",
	valve_name: "Name",
	valve_minutes: "Min",
	manual_only: "Manual only",
	add_times_first: "Add times to the zone",
	remove_valve: "Remove valve",
	new_valve: "unnamed",
	confirm_remove_valve: "Remove valve «{name}» from the zone? The change applies on save.",
	drag: "Drag to reorder",
	picker_help: "The switch picker hides switches already used in any zone.",
	status_after_save: "Status and ▶ ⏸ ■ buttons appear after the first save.",
	no_valves: "No valves.",
	rule_name: "Enter a name",
	rule_V1: "Choose a switch entity",
	rule_V2: "At least 1 minute",
	rule_V3: "Block not in the zone",
	rule_V4: "Pick at least one day",
	rule_V5: "Add at least one start time",
	rule_V6: "Duplicate time",
	rule_V7: "This switch is already used by another valve",
	rule_V8: "Auto requires a calculation method",
	rule_V9: "Must be 1 or more",
	rule_V12: "Name the valve",
	rule_time: "Invalid time",
	rule_entity: "Invalid entity",
	rule_notify: "Invalid target",
	rule_hours_24: "Between 1 and 24",
	rule_hours_6_24: "Between 6 and 24",
	rule_positive: "Must be greater than 0",
	rule_unknown: "Invalid value",
	concurrency: "Concurrency",
	limit_global: "Limit open valves across the whole installation",
	global_max: "Global maximum",
	global_off_help: "Off = no global limit.",
	notifications: "Notifications",
	notifications_help: "Phones that receive push alerts. Tap one to turn it on or off. Each alert picks which ones in «Errors and alerts».",
	no_targets: "No mobile devices with the HA app.",
	alerts: "Errors and alerts",
	alerts_help: "Which alerts reach your phone and which show in the history. All are always recorded in HA.",
	alerts_no_targets: "No phones in Notifications: turn one on to receive push alerts.",
	level_valve: "Valve",
	level_zone: "Zone",
	level_installation: "Installation",
	alert_push: "Push",
	alert_priority: "Priority",
	alert_history: "History",
	alert_details: "More options",
	alert_all_targets: "All",
	priority_critical: "Critical",
	priority_high: "High",
	priority_normal: "Normal",
	alert_turn_on_failed: "Valve does not turn on",
	alert_turn_on_failed_help: "No response to turn on after 3 retries. The job is dropped and the queue continues.",
	alert_turn_off_failed: "Valve does not turn off",
	alert_turn_off_failed_help: "No response to turn off after 3 retries: it may still be watering. Minimum priority: high.",
	alert_overrun_restart: "Time exceeded while HA was down",
	alert_overrun_restart_help: "On HA start, a valve was past its time. It is turned off.",
	alert_overrun_running: "Time exceeded",
	alert_overrun_running_help: "Still open past its time. The 5-minute check turns it off.",
	alert_manual_overrun: "Turned on manually too long",
	alert_manual_overrun_help: "Turned on outside irrigation for longer than its duration. The 5-minute check turns it off.",
	alert_sensor_unavailable: "Sensor unavailable",
	alert_sensor_unavailable_help: "A zone sensor becomes unavailable or unknown.",
	alert_rain_skipped: "Watering skipped due to rain",
	alert_rain_skipped_help: "A zone block does not water due to rain. One push when the zone starts skipping for rain.",
	alert_rain_source_unavailable: "Rain source unavailable",
	alert_rain_source_unavailable_help: "The rain gauge or the forecast gives no data when deciding. It waters.",
	alert_valve_switched: "Valve turned on/off",
	alert_valve_switched_help: "One push on turn on and one on turn off, with the time open. Scheduled, manual or external. Not marked in the history.",
	rule_alert: "Unknown alert",
	rule_alert_priority: "Priority not allowed for this alert",
	rain_help: "Only for zones with «Skip on rain». A block does not water if either condition is met. A manual command always waters.",
	rain_past: "Rain already fallen",
	rain_sensor: "Rain gauge: accumulated or rate rain sensor (optional)",
	rain_past_hours: "Look back over the last… (hours, 1–24)",
	rain_past_threshold: "Don't water if at least this fell…",
	rain_past_rule: "Does not water if {amount} {unit} or more fell in the last {hours} hours.",
	rain_forecast: "Forecast rain",
	weather_entity: "Forecast: weather entity (optional)",
	weather_no_hourly: "This entity has no hourly forecast: forecast rain will not work.",
	rain_forecast_hours: "Look ahead over the next… (hours, 6–24)",
	rain_forecast_threshold: "Don't water if at least this is forecast…",
	rain_forecast_rule: "Does not water if {amount} {unit} or more is forecast in the next {hours} hours.",
	settings_saved: "Settings saved",
	settings_not_saved: "Settings not saved: check the highlighted fields.",
	card_description: "Status and control of irrigation zones.",
	card_bad_zones: "«zones» must be a list of zone IDs.",
	card_all_zones: "With no zones picked, the card shows all of them.",
	card_zones: "Zones",
	card_order_help: "Chip order is the order in the card.",
	card_title: "Title (optional)",
	history_description: "Actual valve runs by zone.",
	history_view_timeline: "Timeline",
	history_view_totals: "Totals",
	history_hours: "{n} h",
	history_days: "{n} d",
	history_custom: "Other…",
	history_range: "Range…",
	history_unit_hours: "hours",
	history_unit_days: "days",
	history_from: "From",
	history_to: "To",
	history_empty: "No runs in this window",
	history_unavailable: "History unavailable",
	history_ongoing: "ongoing",
	history_runs_one: "1 run",
	history_runs: "{n} runs",
	history_card_view: "Initial view",
	history_card_window: "Initial window",
	history_card_help: "Data from the HA recorder. Switches excluded from the recorder show no runs.",
	history_run: "Irrigation",
	history_run_scheduled: "Scheduled irrigation",
	history_run_manual: "Manual irrigation",
	history_run_external: "External irrigation",
	history_watered: "Watered: {time}",
	history_before_window: "Started before this window",
	history_installation: "Installation"
};
function tt(e) {
	return (e?.locale?.language ?? e?.language ?? document.documentElement.lang)?.startsWith("es") ? "es" : "en";
}
function A(e, t, n = {}) {
	return (tt(e) === "es" ? $e[t] : et[t]).replace(/\{(\w+)\}/g, (e, t) => t in n ? String(n[t]) : e);
}
function nt(e) {
	return tt(e) === "es" ? [
		"L",
		"M",
		"X",
		"J",
		"V",
		"S",
		"D"
	] : [
		"M",
		"T",
		"W",
		"T",
		"F",
		"S",
		"S"
	];
}
function j(e, t) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: t,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(e);
}
function rt(e, t, n) {
	return new Intl.DateTimeFormat(n, {
		timeZone: t,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).format(e);
}
function it(e, t, n) {
	return new Intl.DateTimeFormat(n, {
		timeZone: t,
		weekday: "short"
	}).format(e);
}
function at(e, t) {
	if (!t) return "—";
	let n = e.config.time_zone, r = tt(e), i = new Date(t), a = rt(i, n, r), o = /* @__PURE__ */ new Date();
	return j(i, n) === j(o, n) ? A(e, "today", { time: a }) : j(i, n) === j(new Date(o.getTime() + 864e5), n) ? A(e, "tomorrow", { time: a }) : `${it(i, n, r)} ${a}`;
}
function M(e, t, n = "full") {
	let r = e.config.time_zone, i = tt(e), a = new Date(t), o = rt(a, r, i);
	if (n === "time") return o;
	let s = new Intl.DateTimeFormat(i, {
		timeZone: r,
		day: "numeric"
	}).format(a), c = `${it(a, r, i)} ${s}`;
	return n === "day" ? c : `${c} ${o}`;
}
function ot(e, t, n) {
	let r = e.config.time_zone;
	return j(new Date(t), r) === j(new Date(n), r);
}
function N(e) {
	let t = Math.max(0, Math.round(e)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${n}:${String(r).padStart(2, "0")}:${i}` : `${r}:${i}`;
}
function st(e, t) {
	if (t.rule === "V10" || t.rule === "V11") return String(t.path[t.path.length - 1]).endsWith("_hours") ? A(e, t.rule === "V10" ? "rule_hours_24" : "rule_hours_6_24") : A(e, "rule_positive");
	let n = `rule_${t.rule}`;
	return n in $e ? A(e, n) : A(e, "rule_unknown");
}
function ct(e, t) {
	let n = {};
	for (let r of t) n[r.path.join(".")] ??= st(e, r);
	return n;
}
//#endregion
//#region src/store.ts
var lt = 3e4, ut = /* @__PURE__ */ new WeakMap();
function dt(e, t) {
	e.state = t;
	for (let n of e.listeners) n(t);
}
function ft(e, t) {
	let n = e.subscribeMessage((e) => dt(t, { snapshot: e }), { type: Be });
	t.unsubscribe = n, n.catch((r) => {
		if (t.unsubscribe !== n) return;
		t.unsubscribe = void 0;
		let i = r?.code;
		dt(t, { error: i === "not_loaded" ? "not_loaded" : "unknown" }), t.retry = window.setTimeout(() => {
			t.retry = void 0, t.listeners.size && ft(e, t);
		}, lt);
	});
}
function pt(e, t) {
	let n = ut.get(e);
	n || (n = {
		state: {},
		listeners: /* @__PURE__ */ new Set()
	}, ut.set(e, n));
	let r = n;
	return r.listeners.add(t), (r.state.snapshot || r.state.error) && t(r.state), !r.unsubscribe && r.retry === void 0 && ft(e, r), () => {
		if (r.listeners.delete(t), r.listeners.size) return;
		window.clearTimeout(r.retry), r.retry = void 0;
		let e = r.unsubscribe;
		r.unsubscribe = void 0, r.state = {}, e?.then((e) => e()).catch(() => void 0);
	};
}
var P = class {
	constructor(e) {
		this.state = {}, this.host = e, e.addController(this);
	}
	hostConnected() {
		this.sync();
	}
	hostUpdate() {
		this.sync();
	}
	hostDisconnected() {
		this.release?.(), this.release = void 0, this.connection = void 0;
	}
	sync() {
		let e = this.host.hass?.connection;
		e !== this.connection && (this.release?.(), this.connection = e, this.state = {}, this.release = e ? pt(e, (e) => {
			this.state = e, this.host.requestUpdate();
		}) : void 0);
	}
}, mt = class {
	constructor(e) {
		this.host = e, e.addController(this);
	}
	hostConnected() {
		this.timer = window.setInterval(() => this.host.requestUpdate(), 1e3);
	}
	hostDisconnected() {
		window.clearInterval(this.timer), this.timer = void 0;
	}
}, ht = "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z", gt = "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z", _t = "M8,5.14V19.14L19,12.14L8,5.14Z", vt = {
	run: _t,
	resume: _t,
	pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
	stop: "M18,18H6V6H18V18Z"
}, yt = {
	run: "action_run",
	resume: "action_resume",
	pause: "action_pause",
	stop: "action_stop"
};
function F(e, t, n) {
	e.dispatchEvent(new CustomEvent(t, {
		detail: n,
		bubbles: !0,
		composed: !0
	}));
}
function I(e, t) {
	let n = e.isConnected ? e : document.querySelector("home-assistant");
	n && F(n, "hass-notification", { message: t });
}
function bt(e, t) {
	let n = t?.message;
	return typeof n == "string" && n ? n : A(e, "command_failed");
}
async function xt(e, t, n) {
	try {
		await n(t);
	} catch (n) {
		I(e, bt(t, n));
	}
}
function L(e, t, n, r) {
	let i = A(t, yt[n.action]);
	return S`<button
    class="control ${n.action === "stop" ? "danger" : ""}"
    title=${i}
    aria-label=${r ?? i}
    ?disabled=${!t.connected}
    @click=${(r) => {
		r.stopPropagation(), xt(e, t, n.run);
	}}
  >
    ${R(vt[n.action])}${r ? S`<span class="text">${r}</span>` : w}
  </button>`;
}
function R(e) {
	return S`<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d=${e}></path></svg>`;
}
//#endregion
//#region src/shared/ha-components.ts
function St(e, t) {
	customElements.get(e) || customElements.define(e, t);
}
function z(e, t) {
	customElements.whenDefined("home-assistant").then(() => St(e, t));
}
function B(e) {
	return e.detail?.value;
}
var Ct = 1e4, wt;
async function Tt() {
	if (customElements.get("ha-selector")) return;
	await customElements.whenDefined("partial-panel-resolver");
	let e = document.createElement("partial-panel-resolver");
	e.hass = { panels: [{
		url_path: "tmp",
		component_name: "config"
	}] }, e._updateRoutes?.(), await e.routerOptions.routes.tmp.load(), await customElements.whenDefined("ha-panel-config"), await document.createElement("ha-panel-config").routerOptions.routes.automation.load(), await customElements.whenDefined("ha-selector");
}
function Et() {
	return wt ??= Promise.race([Tt().catch((e) => console.warn("Irrigation Scheduler: ha-selector", e)), new Promise((e) => window.setTimeout(e, Ct))]), wt;
}
function Dt(e) {
	window.customCards ??= [], window.customCards.some((t) => t.type === e.type) || window.customCards.push(e);
}
//#endregion
//#region src/shared/styles.ts
var V = o`
  :host {
    color: var(--primary-text-color);
  }
  h3 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 500;
  }
  ha-selector {
    display: block;
  }
  .muted {
    color: var(--secondary-text-color);
  }
  .card {
    background: var(--ha-card-background, var(--card-background-color));
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
    padding: 16px;
  }
  .section {
    margin-bottom: 16px;
  }
  .label {
    font-weight: 500;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .small {
    font-size: 0.875em;
  }
  .error-text {
    color: var(--error-color);
    font-size: 0.8em;
    margin-top: 4px;
  }
  .banner {
    padding: 12px 16px;
    margin-bottom: 16px;
    border-radius: var(--ha-card-border-radius, 12px);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .banner.error {
    background: rgba(var(--rgb-error-color, 219, 68, 55), 0.15);
    color: var(--error-color);
  }
  .banner.warning {
    background: rgba(var(--rgb-warning-color, 255, 166, 0), 0.15);
  }
  .banner.info {
    background: rgba(var(--rgb-info-color, 3, 155, 229), 0.12);
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.8em;
    font-weight: 500;
    white-space: nowrap;
  }
  .badge.running {
    background: var(--primary-color);
    color: var(--text-primary-color);
  }
  .badge.queued {
    background: var(--accent-color);
    color: var(--text-accent-color, var(--text-primary-color));
  }
  .badge.idle {
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
  }
  .badge.stopped {
    background: var(--disabled-color, #bdbdbd);
    color: var(--text-primary-color);
  }
  button {
    font: inherit;
    cursor: pointer;
    border: 1px solid var(--divider-color);
    border-radius: 18px;
    background: transparent;
    color: var(--primary-color);
    padding: 4px 12px;
    min-height: 32px;
    white-space: nowrap;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  button.danger {
    color: var(--error-color);
  }
  button.filled {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
  }
  button.icon {
    border: none;
    min-width: 32px;
    padding: 4px 8px;
  }
  button.control {
    min-width: 36px;
    padding: 4px 8px;
  }
  button.control,
  button.with-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .svg-icon {
    width: 18px;
    height: 18px;
    flex: none;
    fill: currentColor;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chip {
    border-radius: 16px;
    padding: 4px 10px;
    min-height: 28px;
    color: var(--primary-text-color);
  }
  .chip.on {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
  }
  .list-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider-color);
    cursor: pointer;
  }
  .list-row:last-child {
    border-bottom: none;
  }
  .progress {
    height: 4px;
    border-radius: 2px;
    background: var(--divider-color);
    overflow: hidden;
    margin-top: 4px;
  }
  .progress > div {
    height: 100%;
    background: var(--primary-color);
  }
  .spacer {
    flex: 1;
  }
  select,
  input {
    font: inherit;
    color: var(--primary-text-color);
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 16px;
    padding: 4px 10px;
    min-height: 30px;
    color-scheme: light dark;
  }
`, Ot = o`
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 12px;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--app-header-background-color);
    color: var(--app-header-text-color, var(--text-primary-color));
    border-bottom: var(--app-header-border-bottom, none);
  }
  .toolbar > * {
    /* los botones no se encogen: si no caben, el título cede con elipsis */
    flex-shrink: 0;
  }
  .toolbar .title {
    flex-shrink: 1;
    min-width: 0;
    font-size: 20px;
    margin-right: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .toolbar button {
    color: inherit;
    border-color: currentColor;
  }
  .toolbar button.filled {
    background: var(--app-header-text-color, var(--text-primary-color));
    color: var(--app-header-background-color, var(--primary-color));
  }
  .toolbar .tab {
    border: none;
    border-radius: 0;
    border-bottom: 2px solid transparent;
  }
  .toolbar .tab.active {
    border-bottom-color: currentColor;
  }
`, kt = "irrigation-confirm-dialog";
z(kt, class extends O {
	firstUpdated() {
		this.renderRoot.querySelector("dialog")?.showModal();
	}
	close(e) {
		this.renderRoot.querySelector("dialog")?.close(), this.done(e);
	}
	render() {
		let { text: e, confirmText: t, destructive: n, single: r } = this.options;
		return S`<dialog
      @cancel=${(e) => {
			e.preventDefault(), this.close(!1);
		}}
      @click=${(e) => {
			e.target === e.currentTarget && this.close(!1);
		}}
    >
      <div class="body">${e}</div>
      <div class="actions">
        ${r ? w : S`<button @click=${() => this.close(!1)}>${A(this.hass, "cancel")}</button>`}
        <button class=${n ? "destructive" : "filled"} autofocus @click=${() => this.close(!0)}>
          ${t}
        </button>
      </div>
    </dialog>`;
	}
	static {
		this.styles = [V, o`
      dialog {
        padding: 0;
        border: none;
        border-radius: var(--ha-dialog-border-radius, 24px);
        background: var(--ha-dialog-surface-background, var(--card-background-color));
        color: var(--primary-text-color);
        max-width: min(420px, calc(100vw - 32px));
        box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0, 0, 0, 0.4));
      }
      dialog::backdrop {
        background: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.32));
      }
      .body {
        padding: 24px 24px 8px;
        line-height: 1.5;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 24px 24px;
      }
      button.destructive {
        background: var(--error-color);
        border-color: var(--error-color);
        color: var(--text-primary-color, #fff);
      }
    `];
	}
});
function H(e, t) {
	return new Promise((n) => {
		let r = document.createElement(kt);
		r.hass = e, r.options = t, r.done = (e) => {
			r.remove(), n(e);
		}, document.body.append(r);
	});
}
async function At(e, t) {
	await H(e, {
		text: t,
		confirmText: A(e, "dialog_ok"),
		single: !0
	});
}
//#endregion
//#region node_modules/lit-html/directive.js
var U = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, jt = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), Mt = class {
	constructor(e) {}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AT(e, t, n) {
		this._$Ct = e, this._$AM = t, this._$Ci = n;
	}
	_$AS(e, t) {
		return this.update(e, t);
	}
	update(e, t) {
		return this.render(...t);
	}
}, Nt = "important", Pt = " !" + Nt, Ft = jt(class extends Mt {
	constructor(e) {
		if (super(e), e.type !== U.ATTRIBUTE || e.name !== "style" || e.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
	}
	render(e) {
		return Object.keys(e).reduce((t, n) => {
			let r = e[n];
			return r == null ? t : t + `${n = n.includes("-") ? n : n.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, "-$&").toLowerCase()}:${r};`;
		}, "");
	}
	update(e, [t]) {
		let { style: n } = e.element;
		if (this.ft === void 0) return this.ft = new Set(Object.keys(t)), this.render(t);
		for (let e of this.ft) t[e] ?? (this.ft.delete(e), e.includes("-") ? n.removeProperty(e) : n[e] = null);
		for (let e in t) {
			let r = t[e];
			if (r != null) {
				this.ft.add(e);
				let t = typeof r == "string" && r.endsWith(Pt);
				e.includes("-") || t ? n.setProperty(e, t ? r.slice(0, -11) : r, t ? Nt : "") : n[e] = r;
			}
		}
		return C;
	}
}), It = {
	running: "💧",
	manual: "💧",
	queued: "⏳",
	idle: "○",
	stopped: "⊘"
}, Lt = {
	running: "status_running",
	manual: "status_manual",
	queued: "status_queued",
	idle: "status_idle",
	stopped: "status_stopped"
};
function Rt(e, t) {
	let n = t.open_valves.find((t) => t.entity_id === e.entity_id);
	return n ? {
		state: "running",
		open: n
	} : t.manual_on.some((t) => t.entity_id === e.entity_id) ? { state: "manual" } : t.pending.some((t) => t.entity_id === e.entity_id) ? { state: "queued" } : { state: e.enabled ? "idle" : "stopped" };
}
function zt(e) {
	return (Date.parse(e.ends_at) - Date.now()) / 1e3;
}
function Bt(e) {
	let t = Date.parse(e.started_at), n = Date.parse(e.ends_at) - t;
	return S`<div class="progress"><div style=${Ft({ width: `${(n > 0 ? Math.min(1, Math.max(0, (Date.now() - t) / n)) : 1) * 100}%` })}></div></div>`;
}
function Vt(e, t) {
	return t.open ? A(e, "remaining", { time: N(zt(t.open)) }) : A(e, Lt[t.state]);
}
function Ht(e, t) {
	let n = e.entity_id, r = {
		action: "stop",
		run: (e) => Ye(e, n, !1)
	};
	switch (t.state) {
		case "running":
		case "manual":
		case "queued": return [{
			action: "pause",
			run: (e) => Je(e, n)
		}, r];
		case "idle": return [{
			action: "run",
			run: (e) => Ke(e, n)
		}, r];
		case "stopped": return [{
			action: "resume",
			run: (e) => Ye(e, n, !0)
		}];
	}
}
function Ut(e, t, n, r) {
	let i = Rt(r, n), a = "";
	return i.open ? a = N(zt(i.open)) : i.state !== "idle" && (a = Vt(t, i).toLocaleLowerCase()), S`<div class="valve-row">
    <span class="valve-icon">${It[i.state]}</span>
    <div class="valve-main">
      <div>${r.name} · ${A(t, "minutes_short", { n: r.duration_min })}</div>
      ${i.open ? Bt(i.open) : w}
    </div>
    <span class="small muted valve-time">${a}</span>
    <div class="valve-buttons">${Ht(r, i).map((n) => L(e, t, n))}</div>
  </div>`;
}
var Wt = o`
  .valve-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .valve-icon {
    width: 24px;
    text-align: center;
  }
  .valve-main {
    flex: 1;
    min-width: 0;
  }
  .valve-time {
    white-space: nowrap;
  }
  .valve-buttons {
    display: flex;
    gap: 4px;
    flex: none;
  }
`, Gt = {
	running: "status_running",
	queued: "status_queued",
	idle: "status_idle",
	stopped: "status_stopped"
}, Kt = {
	running: "💧",
	queued: "⏳",
	idle: "○",
	stopped: "⊘"
}, qt = {
	run: "zone_run",
	resume: "zone_resume",
	pause: "zone_pause",
	stop: "zone_stop"
};
function Jt(e, t) {
	return e.enabled ? e.status === "idle" && t.manual_on.some((t) => t.zone_id === e.zone_id) ? "running" : e.status : "stopped";
}
function Yt(e, t) {
	return S`<span class="badge ${t}">${A(e, Gt[t])}</span>`;
}
function Xt(e, t) {
	let n = nt(e);
	return `${t.days.length === 7 ? A(e, "every_day") : t.days.map((e) => n[e]).join(" ")} · ${t.start_times.length ? t.start_times.join(", ") : A(e, "no_times")} · ${t.valves.length === 1 ? A(e, "valves_one") : A(e, "valves_count", { n: t.valves.length })}`;
}
function Zt(e) {
	if (e.batch_started_at && e.batch_ends_at) return {
		started_at: e.batch_started_at,
		ends_at: e.batch_ends_at
	};
}
function Qt(e, t) {
	for (let n of e.valves) {
		let e = t.open_valves.find((e) => e.entity_id === n.entity_id);
		if (e) return {
			valve: n,
			open: e
		};
	}
	let n = e.valves.find((e) => t.manual_on.some((t) => t.entity_id === e.entity_id));
	return n ? { valve: n } : void 0;
}
function $t(e, t) {
	let n = e.zone_id, r = {
		action: "stop",
		run: (e) => Xe(e, n, !1)
	};
	switch (t) {
		case "running":
		case "queued": return [{
			action: "pause",
			run: (e) => qe(e, n)
		}, r];
		case "idle": return [{
			action: "run",
			run: (e) => Ge(e, n)
		}, r];
		case "stopped": return [{
			action: "resume",
			run: (e) => Xe(e, n, !0)
		}];
	}
}
z("irrigation-zone-list", class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			snapshot: { attribute: !1 },
			_expanded: { state: !0 }
		};
	}
	constructor() {
		super(), this._expanded = /* @__PURE__ */ new Set(), new mt(this);
	}
	render() {
		if (!this.hass || !this.snapshot) return w;
		let e = this.snapshot.zones;
		return S`
      <ha-card>
        ${e.length ? e.map((e) => this.renderRow(e)) : S`<div class="empty muted">${A(this.hass, "empty_list")}</div>`}
      </ha-card>
      <button class="fab filled" @click=${() => this.open(null)}>${A(this.hass, "add_zone")}</button>
    `;
	}
	renderRow(e) {
		let t = this.hass, n = Jt(e, this.snapshot), r = n === "running" ? Qt(e, this.snapshot) : void 0, i = n === "running" ? Zt(e) : void 0, a = this._expanded.has(e.zone_id);
		return S`<div class="zone ${n === "stopped" ? "stopped" : ""}">
      <div class="list-row" @click=${() => this.open(e.zone_id)}>
        <button
          class="icon expand"
          title=${A(t, "valves")}
          aria-label=${A(t, "valves")}
          aria-expanded=${a ? "true" : "false"}
          @click=${(t) => {
			t.stopPropagation(), this.toggle(e.zone_id);
		}}
        >
          ${R(a ? gt : ht)}
        </button>
        <div class="main">
          <div class="name">${e.name}</div>
          <div class="muted small">${Xt(t, e)}</div>
        </div>
        <div class="status">
          ${Yt(t, n)}
          ${i ? S`<div class="small">${A(t, "batch")} · ${N(zt(i))}</div>` : r ? S`<div class="small">${r.valve.name}</div>` : w}
        </div>
        <div class="next small muted">${at(t, e.next_run)}</div>
        <div class="buttons">${$t(e, n).map((e) => L(this, t, e))}</div>
        <span class="chevron muted">›</span>
      </div>
      ${a ? S`<div class="valves">
            ${e.valves.map((e) => Ut(this, t, this.snapshot, e))}
          </div>` : w}
    </div>`;
	}
	toggle(e) {
		let t = new Set(this._expanded);
		t.has(e) ? t.delete(e) : t.add(e), this._expanded = t;
	}
	open(e) {
		F(this, "zone-open", { zoneId: e });
	}
	static {
		this.styles = [
			V,
			Wt,
			o`
      :host {
        display: block;
        padding-bottom: 80px;
      }
      .main {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-weight: 500;
      }
      .status {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        min-width: 120px;
      }
      .next {
        min-width: 90px;
        text-align: right;
      }
      .buttons {
        display: flex;
        gap: 4px;
        min-width: 84px;
        justify-content: flex-end;
      }
      .chevron {
        font-size: 1.4em;
      }
      .stopped {
        opacity: 0.6;
      }
      .zone + .zone {
        border-top: 1px solid var(--divider-color);
      }
      .zone .list-row {
        border-bottom: none;
      }
      button.expand {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
        padding: 0;
        color: var(--secondary-text-color);
      }
      button.expand .svg-icon {
        width: 28px;
        height: 28px;
      }
      .valves {
        /* sangría = padding de la fila + botón de desplegar + hueco */
        padding: 0 16px 8px 68px;
      }
      .empty {
        padding: 24px 16px;
      }
      @media (max-width: 600px) {
        /* móvil: dos líneas; arriba nombre y estado, abajo próximo riego y botones */
        .list-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          grid-template-areas:
            "expand main status chevron"
            "expand next buttons chevron";
          column-gap: 8px;
          row-gap: 8px;
          padding: 12px;
        }
        .expand {
          grid-area: expand;
          align-self: center;
        }
        .main {
          grid-area: main;
        }
        .valves {
          padding: 0 12px 8px 12px;
        }
        .status {
          grid-area: status;
          min-width: 0;
        }
        .next {
          grid-area: next;
          min-width: 0;
          text-align: left;
          align-self: center;
        }
        .buttons {
          grid-area: buttons;
          min-width: 0;
        }
        .chevron {
          grid-area: chevron;
          align-self: center;
        }
      }
      .fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        min-height: 48px;
        padding: 0 20px;
        border-radius: 24px;
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.3));
      }
    `
		];
	}
});
//#endregion
//#region node_modules/lit-html/directive-helpers.js
var { I: en } = Fe, tn = (e) => e, nn = (e) => e.strings === void 0, rn = () => document.createComment(""), W = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new en(r.insertBefore(rn(), i), r.insertBefore(rn(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = tn(e).nextSibling;
				tn(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, G = (e, t, n = e) => (e._$AI(t, n), e), an = {}, on = (e, t = an) => e._$AH = t, sn = (e) => e._$AH, cn = (e) => {
	e._$AR(), e._$AA.remove();
}, ln = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, un = jt(class extends Mt {
	constructor(e) {
		if (super(e), e.type !== U.CHILD) throw Error("repeat() can only be used in text expressions");
	}
	dt(e, t, n) {
		let r;
		n === void 0 ? n = t : t !== void 0 && (r = t);
		let i = [], a = [], o = 0;
		for (let t of e) i[o] = r ? r(t, o) : o, a[o] = n(t, o), o++;
		return {
			values: a,
			keys: i
		};
	}
	render(e, t, n) {
		return this.dt(e, t, n).values;
	}
	update(e, [t, n, r]) {
		let i = sn(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = G(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = G(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = G(i[d], a[m]), W(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = G(i[f], a[p]), W(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = ln(o, p, m), u = ln(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = W(e, i[d]);
					G(t, a[p]), c[p] = t;
				} else c[p] = G(n, a[p]), W(e, i[d], n), i[t] = null;
				p++;
			} else cn(i[f]), f--;
		} else cn(i[d]), d++;
		for (; p <= m;) {
			let t = W(e, c[m + 1]);
			G(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && cn(e);
		}
		return this.ut = o, on(e, c), C;
	}
}), dn = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], fn = 0, pn = "M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z";
function mn(e) {
	return {
		zone_id: e.zone_id ?? null,
		name: e.name,
		enabled: e.enabled,
		mode: e.mode,
		days: [...e.days],
		start_times: [...e.start_times],
		max_simultaneous: e.max_simultaneous,
		rain_skip: e.rain_skip,
		sensors: { ...e.sensors },
		calc_method: e.calc_method,
		valves: e.valves.map((e) => ({
			...e,
			start_times: [...e.start_times],
			key: fn++
		}))
	};
}
function hn() {
	return {
		zone_id: null,
		name: "",
		enabled: !0,
		mode: "manual",
		days: [...dn],
		start_times: [],
		max_simultaneous: 1,
		rain_skip: !0,
		sensors: {
			temperature: null,
			humidity: null,
			soil_moisture: null
		},
		calc_method: null,
		valves: []
	};
}
function K(e) {
	return JSON.stringify([
		e.name,
		e.mode,
		e.days,
		e.start_times,
		e.max_simultaneous,
		e.rain_skip,
		e.sensors,
		e.calc_method,
		e.valves.map((e) => [
			e.entity_id,
			e.name,
			e.duration_min,
			e.start_times
		])
	]);
}
z("irrigation-zone-editor", class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			narrow: { type: Boolean },
			hideControls: {
				type: Boolean,
				attribute: "hide-controls",
				reflect: !0
			},
			snapshot: { attribute: !1 },
			zoneId: { attribute: !1 },
			_draft: { state: !0 },
			_errors: { state: !0 },
			_banner: { state: !0 },
			_external: { state: !0 },
			_saving: { state: !0 },
			_newTime: { state: !0 },
			_dragKey: { state: !0 },
			_overKey: { state: !0 }
		};
	}
	constructor() {
		super(), this.loaded = !1, this.loadedId = null, this.baseline = "", this.seen = !1, this.deleting = !1, this.narrow = !1, this.hideControls = !1, this._draft = void 0, this._errors = {}, this._banner = void 0, this._external = !1, this._saving = !1, this._newTime = "", this._dragKey = void 0, this._overKey = void 0, new mt(this);
	}
	get dirty() {
		return this._draft !== void 0 && K(this._draft) !== this.baseline;
	}
	liveZone() {
		return this.loadedId === null ? void 0 : this.snapshot.zones.find((e) => e.zone_id === this.loadedId);
	}
	willUpdate(e) {
		this.hass && this.snapshot && (!this.loaded || e.has("zoneId") && this.zoneId !== this.loadedId ? this.load() : e.has("snapshot") && this.checkExternal());
	}
	load() {
		if (this.loaded = !0, this.loadedId = this.zoneId, this.deleting = !1, this._errors = {}, this._banner = void 0, this._external = !1, this.zoneId === null) {
			this._draft = hn(), this.baseline = K(this._draft), this.seen = !1;
			return;
		}
		let e = this.liveZone();
		if (!e) {
			this._draft = void 0, this.leaveDeleted();
			return;
		}
		this.seen = !0, this._draft = mn(e), this.baseline = K(e);
	}
	checkExternal() {
		if (this._saving) return;
		let e = this.liveZone();
		if (!e) {
			this.seen && !this.deleting && this.leaveDeleted();
			return;
		}
		this.seen = !0;
		let t = K(e);
		t !== this.baseline && (this._draft && t === K(this._draft) ? this.baseline = t : this._external = !0);
	}
	leaveDeleted() {
		this.updateComplete.then(() => {
			I(this, A(this.hass, "zone_deleted")), F(this, "zone-close");
		});
	}
	reloadFromLive() {
		let e = this.liveZone();
		e && (this._draft = mn(e), this.baseline = K(e), this._external = !1, this._errors = {}, this._banner = void 0);
	}
	patch(e) {
		this._draft &&= {
			...this._draft,
			...e
		};
	}
	clearErrors(e) {
		this._errors = Object.fromEntries(Object.entries(this._errors).filter(([t]) => !t.startsWith(e)));
	}
	setValves(e, t) {
		this.patch({ valves: e }), t && this.clearErrors("valves.");
	}
	patchValve(e, t) {
		this._draft && this.setValves(this._draft.valves.map((n) => n.key === e ? {
			...n,
			...t
		} : n), !1);
	}
	toggleDay(e) {
		if (!this._draft) return;
		let t = this._draft.days.includes(e) ? this._draft.days.filter((t) => t !== e) : [...this._draft.days, e].sort((e, t) => e - t);
		this.patch({ days: t });
	}
	addTime() {
		if (!this._draft) return;
		let e = this._newTime.slice(0, 5);
		/^\d{2}:\d{2}$/.test(e) && !this._draft.start_times.includes(e) && (this.patch({ start_times: [...this._draft.start_times, e].sort() }), this.clearErrors("start_times"), this._newTime = "");
	}
	removeTime(e) {
		this._draft && (this.patch({
			start_times: this._draft.start_times.filter((t) => t !== e),
			valves: this._draft.valves.map((t) => ({
				...t,
				start_times: t.start_times.filter((t) => t !== e)
			}))
		}), this.clearErrors("start_times"));
	}
	toggleValveTime(e, t) {
		let n = this._draft, r = n?.valves.find((t) => t.key === e);
		if (!n || !r) return;
		let i = new Set(r.start_times);
		i.has(t) ? i.delete(t) : i.add(t), this.patchValve(e, { start_times: n.start_times.filter((e) => i.has(e)) });
	}
	addValve() {
		this._draft && this.setValves([...this._draft.valves, {
			entity_id: "",
			name: "",
			duration_min: 10,
			start_times: [],
			enabled: !0,
			key: fn++
		}], !0);
	}
	async removeValve(e) {
		if (!this._draft) return;
		let t = e.name || e.entity_id || A(this.hass, "new_valve");
		await H(this.hass, {
			text: A(this.hass, "confirm_remove_valve", { name: t }),
			confirmText: A(this.hass, "confirm_remove"),
			destructive: !0
		}) && this._draft && this.setValves(this._draft.valves.filter((t) => t.key !== e.key), !0);
	}
	dragStart(e, t) {
		e.button === 0 && (e.preventDefault(), e.currentTarget.setPointerCapture(e.pointerId), this._dragKey = t, this._overKey = t);
	}
	dragMove(e) {
		if (this._dragKey === void 0) return;
		let t = [...this.renderRoot.querySelectorAll(".valve[data-key]")];
		if (!t.length) return;
		let n = t.find((t) => e.clientY < t.getBoundingClientRect().bottom) ?? t[t.length - 1];
		this._overKey = Number(n.dataset.key);
	}
	dragEnd() {
		let e = this._draft, t = this._dragKey, n = this._overKey;
		if (this._dragKey = void 0, this._overKey = void 0, !e || t === void 0 || n === void 0 || t === n) return;
		let r = [...e.valves], i = r.findIndex((e) => e.key === t), a = r.findIndex((e) => e.key === n);
		if (i < 0 || a < 0) return;
		let [o] = r.splice(i, 1);
		r.splice(a, 0, o), this.setValves(r, !0);
	}
	entityChanged(e, t) {
		let n = this._draft?.valves.find((t) => t.key === e);
		if (!n) return;
		let r = t ? this.hass.states[t]?.attributes.friendly_name : void 0;
		this.patchValve(e, {
			entity_id: t,
			name: n.name || (r ?? "")
		});
	}
	excluded(e) {
		let t = this.snapshot.zones.filter((e) => e.zone_id !== this.loadedId).flatMap((e) => e.valves.map((e) => e.entity_id)), n = (this._draft?.valves ?? []).filter((t) => t.key !== e).map((e) => e.entity_id);
		return [...t, ...n].filter((e) => e !== "");
	}
	async back() {
		(!this.dirty || await H(this.hass, {
			text: A(this.hass, "confirm_leave"),
			confirmText: A(this.hass, "confirm_leave_action"),
			destructive: !0
		})) && F(this, "zone-close");
	}
	async save() {
		let e = this._draft;
		if (!e || this._saving) return;
		let t = this.liveZone(), n = {
			...e,
			zone_id: this.loadedId,
			enabled: t?.enabled ?? !0,
			valves: e.valves.map((e) => ({
				...e,
				enabled: t?.valves.find((t) => t.entity_id === e.entity_id)?.enabled ?? !0
			}))
		};
		this._saving = !0;
		try {
			let e = await He(this.hass, n);
			if (e.errors.length || !e.zone) {
				this._errors = ct(this.hass, e.errors), this._banner = A(this.hass, "not_saved");
				return;
			}
			let t = e.zone;
			t.zone_id !== this.loadedId && (this.seen = !1), this.loadedId = t.zone_id, this._draft = mn(t), this.baseline = K(t), this._errors = {}, this._banner = void 0, this._external = !1, I(this, A(this.hass, "saved")), F(this, "zone-saved", { zoneId: t.zone_id });
		} catch (e) {
			I(this, bt(this.hass, e));
		} finally {
			this._saving = !1;
		}
	}
	async removeZone() {
		let e = this.loadedId, t = this._draft;
		if (e === null || !t) return;
		let n = this.liveZone()?.name ?? t.name;
		if (await H(this.hass, {
			text: A(this.hass, "confirm_delete", { name: n }),
			confirmText: A(this.hass, "confirm_delete_action"),
			destructive: !0
		})) {
			this.deleting = !0;
			try {
				await Ue(this.hass, e), F(this, "zone-close");
			} catch (e) {
				this.deleting = !1;
				let { code: t, message: n } = e ?? {}, r = typeof n == "string" ? n : "";
				t === "valves_not_off" ? await At(this.hass, A(this.hass, "delete_valves_not_off", { valves: r })) : t === "zone_busy" ? await At(this.hass, A(this.hass, "delete_zone_busy", { valves: r })) : I(this, bt(this.hass, e));
			}
		}
	}
	error(e) {
		let t = this._errors[e];
		return t ? S`<div class="error-text">${t}</div>` : w;
	}
	render() {
		let e = this._draft;
		if (!this.hass || !this.snapshot || !e) return w;
		let t = this.hass, n = this.liveZone(), r = n ? Jt(n, this.snapshot) : void 0;
		return S`
      <div class="toolbar">
        <button class="icon" title=${A(t, "back")} @click=${this.back}>←</button>
        <span class="title">${e.name || A(t, "new_zone")}</span>
        ${n && r && !this.hideControls ? S`${Yt(t, r)}
            ${$t(n, r).map((e) => L(this, t, e, A(t, qt[e.action])))}` : w}
        ${n ? S`<button
              class="danger with-icon"
              title=${A(t, "delete_zone")}
              aria-label=${A(t, "delete_zone")}
              ?disabled=${this._saving || !t.connected}
              @click=${this.removeZone}
            >
              ${R(pn)}<span class="text">${A(t, "delete_zone")}</span>
            </button>` : w}
        <span class="spacer"></span>
        ${this.hideControls ? S`<button ?disabled=${this._saving} @click=${this.back}>${A(t, "cancel")}</button>` : w}
        <button class="filled" ?disabled=${this._saving || !t.connected} @click=${this.save}>
          ${A(t, "save")}
        </button>
      </div>
      <div class="content">
        ${t.connected ? w : S`<div class="banner error">${A(t, "disconnected")}</div>`}
        ${this._external ? S`<div class="banner warning">
              ${A(t, "external_change")}<span class="spacer"></span>
              <button @click=${this.reloadFromLive}>${A(t, "reload")}</button>
            </div>` : w}
        ${this._banner ? S`<div class="banner error">${this._banner}</div>` : w}
        <div class="columns">
          ${this.renderSchedule(e, n)} ${this.renderValves(e, n)}
        </div>
      </div>
    `;
	}
	renderSchedule(e, t) {
		let n = this.hass, r = nt(n), i = Object.entries(this._errors).filter(([e]) => e.startsWith("start_times."));
		return S`<div class="card">
      <div class="section">
        <ha-selector
          .hass=${n}
          .selector=${{ text: {} }}
          .label=${A(n, "field_name")}
          .value=${e.name}
          .required=${!0}
          @value-changed=${(e) => this.patch({ name: B(e) ?? "" })}
        ></ha-selector>
        ${this.error("name")}
      </div>
      <div class="section">
        <div class="label">${A(n, "rain")}</div>
        <ha-selector
          .hass=${n}
          .selector=${{ boolean: {} }}
          .label=${A(n, "rain_skip")}
          .value=${e.rain_skip}
          @value-changed=${(e) => this.patch({ rain_skip: B(e) ?? !1 })}
        ></ha-selector>
        <div class="muted small">${A(n, "rain_skip_help")}</div>
      </div>
      <div class="section">
        <div class="label">${A(n, "mode")}</div>
        <div class="chips">
          <button
            class="chip ${e.mode === "manual" ? "on" : ""}"
            @click=${() => this.patch({ mode: "manual" })}
          >
            ${A(n, "mode_manual")}
          </button>
          <button class="chip ${e.mode === "auto" ? "on" : ""}" disabled>${A(n, "mode_auto")}</button>
        </div>
        <div class="muted small">${A(n, "auto_help")}</div>
        ${this.error("mode")}
      </div>
      <div class="section">
        <div class="label">${A(n, "days")}</div>
        <div class="chips">
          ${dn.map((t) => S`<button
                class="chip ${e.days.includes(t) ? "on" : ""}"
                @click=${() => this.toggleDay(t)}
              >
                ${r[t]}
              </button>`)}
        </div>
        ${this.error("days")}
      </div>
      <div class="section">
        <div class="label">${A(n, "start_times")}</div>
        <div class="chips">
          ${e.start_times.map((e) => S`<button class="chip on" @click=${() => this.removeTime(e)}>${e} ✕</button>`)}
        </div>
        <div class="row add-time">
          <ha-selector
            .hass=${n}
            .selector=${{ time: { no_second: !0 } }}
            .value=${this._newTime}
            @value-changed=${(e) => {
			this._newTime = B(e) ?? "";
		}}
          ></ha-selector>
          <button ?disabled=${!this._newTime} @click=${this.addTime}>${A(n, "add_time")}</button>
        </div>
        ${this.error("start_times")}
        ${i.map(([t, n]) => {
			let r = Number(t.split(".")[1]);
			return S`<div class="error-text">${e.start_times[r] ?? ""} ${n}</div>`;
		})}
      </div>
      <div class="section">
        <ha-selector
          .hass=${n}
          .selector=${{ number: {
			min: 1,
			max: 20,
			mode: "box"
		} }}
          .label=${A(n, "max_simultaneous")}
          .value=${e.max_simultaneous}
          @value-changed=${(e) => this.patch({ max_simultaneous: Math.trunc(B(e) ?? 0) })}
        ></ha-selector>
        ${this.error("max_simultaneous")}
      </div>
      <div class="muted small">
        ${A(n, "next_run", { when: t ? at(n, t.next_run) : "—" })}
      </div>
    </div>`;
	}
	renderValves(e, t) {
		let n = this.hass;
		return S`<div class="card valves">
      <div class="row">
        <h3>${A(n, "valves")}</h3>
        <span class="muted small">${A(n, "queue_order")}</span>
        <span class="spacer"></span>
        <button @click=${this.addValve}>${A(n, "add_valve")}</button>
      </div>
      <div class="table">
        <div class="valve head muted small">
          <span></span><span>${A(n, "col_name")}</span><span>${A(n, "col_entity")}</span>
          <span>${A(n, "col_minutes")}</span><span>${A(n, "col_blocks")}</span>
          ${this.hideControls ? w : S`<span>${A(n, "col_status")}</span><span></span>`}<span></span>
        </div>
        ${e.valves.length ? un(e.valves, (e) => e.key, (n, r) => this.renderValve(e, t, n, r)) : S`<div class="muted small empty">${A(n, "no_valves")}</div>`}
      </div>
      <div class="muted small note">${A(n, "picker_help")}</div>
      ${t || this.hideControls ? w : S`<div class="muted small note">${A(n, "status_after_save")}</div>`}
    </div>`;
	}
	renderValve(e, t, n, r) {
		let i = this.hass, a = `valves.${r}`, o = n.entity_id ? t?.valves.find((e) => e.entity_id === n.entity_id) : void 0, s = o ? Rt(o, this.snapshot) : void 0, c = this._dragKey !== void 0 && this._dragKey !== n.key && this._overKey === n.key;
		return S`<div
      class="valve ${this._dragKey === n.key ? "dragging" : ""} ${c ? "drop-target" : ""}"
      data-key=${n.key}
    >
      <span
        class="handle cell muted f-handle active"
        title=${A(i, "drag")}
        @pointerdown=${(e) => {
			this.dragStart(e, n.key);
		}}
        @pointermove=${(e) => this.dragMove(e)}
        @pointerup=${() => this.dragEnd()}
        @pointercancel=${() => {
			this._dragKey = void 0, this._overKey = void 0;
		}}
        >⋮⋮</span
      >
      <div class="f-name">
        <ha-selector
          .hass=${i}
          .selector=${{ text: {} }}
          .label=${A(i, "valve_name")}
          .value=${n.name}
          .required=${!0}
          @value-changed=${(e) => this.patchValve(n.key, { name: B(e) ?? "" })}
        ></ha-selector>
        ${this.error(`${a}.name`)}
      </div>
      <div class="f-entity">
        <ha-selector
          .hass=${i}
          .selector=${{ entity: {
			domain: "switch",
			exclude_entities: this.excluded(n.key)
		} }}
          .value=${n.entity_id || void 0}
          @value-changed=${(e) => this.entityChanged(n.key, B(e) ?? "")}
        ></ha-selector>
        ${this.error(`${a}.entity_id`)}
      </div>
      <div class="f-minutes">
        <ha-selector
          .hass=${i}
          .selector=${{ number: {
			min: 1,
			max: 600,
			mode: "box"
		} }}
          .label=${A(i, "valve_minutes")}
          .value=${n.duration_min}
          @value-changed=${(e) => this.patchValve(n.key, { duration_min: Math.trunc(B(e) ?? 0) })}
        ></ha-selector>
        ${this.error(`${a}.duration_min`)}
      </div>
      <div class="cell f-blocks">${this.renderBlocks(e, n)} ${this.error(`${a}.start_times`)}</div>
      ${this.hideControls ? w : S`<div class="cell small f-status">
              ${s ? this.renderValveStatus(s) : S`<span class="muted">—</span>`}
            </div>
            <div class="buttons cell f-buttons">
              ${o && s ? Ht(o, s).map((e) => L(this, i, e)) : w}
            </div>`}
      <div class="cell f-remove">
        <button
          class="icon remove"
          title=${A(i, "remove_valve")}
          aria-label=${A(i, "remove_valve")}
          @click=${() => this.removeValve(n)}
        >
          ${R(pn)}
        </button>
      </div>
    </div>`;
	}
	renderBlocks(e, t) {
		let n = this.hass;
		return e.start_times.length ? S`<div class="chips">
        ${e.start_times.map((e) => S`<button
              class="chip ${t.start_times.includes(e) ? "on" : ""}"
              @click=${() => this.toggleValveTime(t.key, e)}
            >
              ${e}
            </button>`)}
      </div>
      ${t.start_times.length ? w : S`<div class="muted small">${A(n, "manual_only")}</div>`}` : S`<span class="muted small">${A(n, "add_times_first")}</span>`;
	}
	renderValveStatus(e) {
		let t = `${It[e.state]} ${Vt(this.hass, e).toLocaleLowerCase()}`;
		return S`<div class="state-${e.state}">${t}</div>
      ${e.open ? Bt(e.open) : w}`;
	}
	static {
		this.styles = [
			V,
			Ot,
			o`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--primary-background-color);
      }
      .content {
        padding: 16px;
        max-width: 1600px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .columns {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .columns {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .add-time {
        margin-top: 8px;
      }
      .add-time ha-selector {
        /* el botón va junto al campo, no al otro extremo de la fila */
        flex: none;
      }
      .table {
        overflow-x: auto;
        margin-top: 8px;
      }
      .valve {
        display: grid;
        grid-template-columns:
          24px minmax(160px, 1fr) minmax(200px, 1fr) 90px minmax(170px, auto)
          150px 96px 32px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        min-width: 960px;
      }
      :host([hide-controls]) .valve {
        grid-template-columns: 24px minmax(160px, 1fr) minmax(200px, 1fr) 90px minmax(170px, auto) 32px;
        min-width: 720px;
      }
      .valve.head {
        align-items: center;
        padding: 4px 0;
      }
      .valve:not(.head) {
        /* arriba: los ha-input suman relleno inferior y el picker de entidad no;
           centrados quedaban a alturas distintas */
        align-items: start;
      }
      .valve .cell {
        /* alto de la caja de un campo de HA, para centrar el resto con ella */
        min-height: 56px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
      }
      .valve.dragging {
        opacity: 0.5;
      }
      .valve.drop-target {
        background: var(--secondary-background-color);
        outline: 2px dashed var(--primary-color);
        outline-offset: -2px;
      }
      button.remove {
        /* 6 + 20 + 6 = 32px, el ancho de su columna; con el relleno común medía 36 y desbordaba la tabla */
        padding: 4px 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--secondary-text-color);
      }
      button.remove:hover:not(:disabled) {
        color: var(--error-color);
      }
      button.remove .svg-icon {
        width: 20px;
        height: 20px;
      }
      .handle {
        user-select: none;
      }
      .handle.active {
        cursor: grab;
        /* sin esto el navegador táctil desplaza la página en vez de mandar pointermove */
        touch-action: none;
      }
      .buttons {
        display: flex;
        gap: 4px;
      }
      .valve .buttons.cell {
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
      }
      .state-running,
      .state-manual {
        color: var(--primary-color);
      }
      .state-queued {
        color: var(--accent-color);
      }
      .state-idle,
      .state-stopped {
        color: var(--secondary-text-color);
      }
      .empty {
        padding: 16px 0;
      }
      .note {
        margin-top: 8px;
      }
      @media (max-width: 600px) {
        /* móvil: la barra no cabe; solo iconos y sin título (el nombre está en el formulario) */
        .toolbar {
          gap: 4px;
          padding: 0 8px;
        }
        .toolbar .title,
        .toolbar button .text {
          display: none;
        }
        .content {
          padding: 8px;
        }
      }
      .valves {
        container-type: inline-size;
      }
      @container (max-width: 700px) {
        /* ancho estrecho: cada válvula en bloque apilado en vez de tabla con scroll lateral */
        .valve.head {
          display: none;
        }
        .valve {
          min-width: 0;
          grid-template-columns: 24px minmax(0, 1fr) 96px 32px;
          grid-template-areas:
            "handle name minutes remove"
            ". entity entity entity"
            ". blocks blocks blocks"
            ". status buttons buttons";
          row-gap: 4px;
          padding: 12px 0;
        }
        :host([hide-controls]) .valve {
          grid-template-columns: 24px minmax(0, 1fr) 96px 32px;
          grid-template-areas:
            "handle name minutes remove"
            ". entity entity entity"
            ". blocks blocks blocks";
          min-width: 0;
        }
        .f-handle {
          grid-area: handle;
        }
        .f-name {
          grid-area: name;
        }
        .f-entity {
          grid-area: entity;
        }
        .f-minutes {
          grid-area: minutes;
        }
        .f-blocks {
          grid-area: blocks;
        }
        .f-status {
          grid-area: status;
        }
        .f-buttons {
          grid-area: buttons;
        }
        .f-remove {
          grid-area: remove;
        }
        .valve .f-blocks,
        .valve .f-status,
        .valve .f-buttons {
          min-height: 36px;
        }
        .valve .buttons.cell {
          justify-content: flex-end;
        }
      }
    `
		];
	}
});
//#endregion
//#region src/alerts.ts
var q = [
	"critical",
	"high",
	"normal"
], gn = [
	"valve",
	"zone",
	"installation"
], _n = [
	{
		id: "turn_on_failed",
		level: "valve",
		priority: "high",
		allowed: q,
		name: "alert_turn_on_failed",
		help: "alert_turn_on_failed_help"
	},
	{
		id: "turn_off_failed",
		level: "valve",
		priority: "critical",
		allowed: ["critical", "high"],
		name: "alert_turn_off_failed",
		help: "alert_turn_off_failed_help"
	},
	{
		id: "overrun_restart",
		level: "valve",
		priority: "high",
		allowed: q,
		name: "alert_overrun_restart",
		help: "alert_overrun_restart_help"
	},
	{
		id: "overrun_running",
		level: "valve",
		priority: "high",
		allowed: q,
		name: "alert_overrun_running",
		help: "alert_overrun_running_help"
	},
	{
		id: "manual_overrun",
		level: "valve",
		priority: "high",
		allowed: q,
		name: "alert_manual_overrun",
		help: "alert_manual_overrun_help"
	},
	{
		id: "sensor_unavailable",
		level: "zone",
		priority: "normal",
		allowed: q,
		name: "alert_sensor_unavailable",
		help: "alert_sensor_unavailable_help"
	},
	{
		id: "rain_skipped",
		level: "zone",
		priority: "normal",
		allowed: q,
		name: "alert_rain_skipped",
		help: "alert_rain_skipped_help"
	},
	{
		id: "rain_source_unavailable",
		level: "installation",
		priority: "normal",
		allowed: q,
		name: "alert_rain_source_unavailable",
		help: "alert_rain_source_unavailable_help"
	},
	{
		id: "valve_switched",
		level: "valve",
		priority: "normal",
		allowed: q,
		name: "alert_valve_switched",
		help: "alert_valve_switched_help",
		pushOnly: !0
	}
], vn = {
	push: !0,
	targets: null,
	priority: null,
	show_in_history: !0
};
function yn(e, t) {
	return {
		...vn,
		...e.alerts[t]
	};
}
//#endregion
//#region src/panel/notify-targets.ts
var bn = "notify.mobile_app_", xn = "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z";
function Sn(e) {
	return e.slice(18).replaceAll("_", " ");
}
//#endregion
//#region src/panel/alert-settings.ts
var Cn = {
	valve: "level_valve",
	zone: "level_zone",
	installation: "level_installation"
}, wn = {
	critical: "priority_critical",
	high: "priority_high",
	normal: "priority_normal"
};
z("irrigation-alert-settings", class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			settings: { attribute: !1 },
			errors: { attribute: !1 },
			_open: { state: !0 }
		};
	}
	constructor() {
		super(), this.errors = {}, this._open = null;
	}
	change(e, t) {
		let n = {
			...yn(this.settings, e),
			...t
		};
		F(this, "alerts-changed", {
			...this.settings.alerts,
			[e]: n
		});
	}
	toggleAll(e, t) {
		this.change(e, { targets: t.targets === null ? [...this.settings.notify_targets] : null });
	}
	toggleTarget(e, t, n) {
		this.change(e, { targets: t.includes(n) ? t.filter((e) => e !== n) : [...t, n] });
	}
	error(e) {
		let t = this.errors[e];
		return t ? S`<div class="error-text">${t}</div>` : w;
	}
	render() {
		let e = this.hass;
		if (!e || !this.settings) return w;
		let t = this.settings.notify_targets.length === 0;
		return S`<div class="card section">
      <div class="label">${A(e, "alerts")}</div>
      <div class="muted small help">${A(e, "alerts_help")}</div>
      ${t ? S`<div class="banner warning">${A(e, "alerts_no_targets")}</div>` : w}
      ${gn.map((n) => S`<div class="row head">
            <span class="name">${A(e, Cn[n])}</span>
            <span class="cell">${A(e, "alert_push")}</span>
            <span class="cell">${A(e, "alert_priority")}</span>
            <span class="cell">${A(e, "alert_history")}</span>
            <span class="expand"></span>
          </div>
          ${_n.filter((e) => e.level === n).map((e) => this.renderRow(e, t))}`)}
    </div>`;
	}
	renderRow(e, t) {
		let n = this.hass, r = yn(this.settings, e.id), i = !r.push || t, a = this._open === e.id;
		return S`<div class="row">
        <span class="name">${A(n, e.name)}</span>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${r.push && !t}
            ?disabled=${t}
            @change=${(t) => this.change(e.id, { push: t.target.checked })}
          />
          <span class="inline-label">${A(n, "alert_push")}</span>
        </label>
        <select
          class="cell"
          aria-label=${A(n, "alert_priority")}
          ?disabled=${i}
          @change=${(t) => this.change(e.id, { priority: t.target.value })}
        >
          ${e.allowed.map((t) => S`<option .value=${t} ?selected=${(r.priority ?? e.priority) === t}>
                ${A(n, wn[t])}
              </option>`)}
        </select>
        <label class="cell">
          <input
            type="checkbox"
            .checked=${r.show_in_history && !e.pushOnly}
            ?disabled=${e.pushOnly}
            @change=${(t) => this.change(e.id, { show_in_history: t.target.checked })}
          />
          <span class="inline-label">${A(n, "alert_history")}</span>
        </label>
        <button
          class="expand ${a ? "open" : ""}"
          aria-label=${A(n, "alert_details")}
          aria-expanded=${a ? "true" : "false"}
          @click=${() => this._open = a ? null : e.id}
        >
          ›
        </button>
      </div>
      ${this.error(`alerts.${e.id}.priority`)} ${a ? this.renderDetail(e, r, i) : w}`;
	}
	renderDetail(e, t, n) {
		let r = this.hass, i = t.targets === null, a = t.targets ?? [];
		return S`<div class="detail">
      <div class="muted small">${A(r, e.help)}</div>
      <div class="chips">
        <button
          class="chip ${i ? "on" : ""}"
          ?disabled=${n}
          aria-pressed=${i ? "true" : "false"}
          @click=${() => this.toggleAll(e.id, t)}
        >
          ${A(r, "alert_all_targets")}
        </button>
        ${this.settings.notify_targets.map((t) => {
			let r = i || a.includes(t);
			return S`<button
            class="chip with-icon ${r ? "on" : ""}"
            ?disabled=${n || i}
            title=${t}
            aria-pressed=${r ? "true" : "false"}
            @click=${() => this.toggleTarget(e.id, a, t)}
          >
            ${R(xn)}${Sn(t)}
          </button>`;
		})}
      </div>
      ${a.map((t, n) => this.error(`alerts.${e.id}.targets.${n}`))}
    </div>`;
	}
	static {
		this.styles = [V, o`
      .help {
        margin-bottom: 12px;
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 64px 112px 72px 32px;
        align-items: center;
        gap: 8px;
        min-height: 40px;
      }
      .row.head {
        margin-top: 12px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .cell {
        justify-self: center;
      }
      select.cell {
        justify-self: stretch;
      }
      input[type="checkbox"] {
        accent-color: var(--primary-color);
      }
      .inline-label {
        display: none;
      }
      .expand {
        background: none;
        border: none;
        color: var(--secondary-text-color);
        font-size: 1.25rem;
        cursor: pointer;
        transition: transform 0.15s;
      }
      .expand.open {
        transform: rotate(90deg);
      }
      .detail {
        padding: 4px 0 12px;
      }
      .detail .chips {
        margin-top: 8px;
      }
      /* estrecho: Push, Prioridad e Histórico bajan a una segunda línea bajo el nombre */
      @media (max-width: 600px) {
        .row {
          grid-template-columns: auto auto 1fr 32px;
          row-gap: 4px;
        }
        .row .name {
          grid-column: 1 / 4;
        }
        .row .expand {
          grid-column: 4;
          grid-row: 1;
        }
        .row.head .cell {
          display: none;
        }
        .inline-label {
          display: inline;
        }
      }
    `];
	}
});
//#endregion
//#region src/panel/settings-view.ts
var Tn = 25.4, En = 2;
function Dn(e) {
	return e.config.unit_system?.accumulated_precipitation === "in" ? "in" : "mm";
}
function On(e, t) {
	return t === "in" ? Math.round(e / Tn * 100) / 100 : e;
}
function kn(e, t) {
	return t === "in" ? e * Tn : e;
}
function An(e, t) {
	let n = t ? e.states[t] : void 0;
	return n !== void 0 && (Number(n.attributes.supported_features ?? 0) & En) === 0;
}
function jn(e) {
	return {
		...e,
		notify_targets: [...e.notify_targets],
		alerts: { ...e.alerts }
	};
}
function Mn(e) {
	return JSON.stringify([
		e.global_max_valves,
		e.notify_targets,
		e.rain_sensor,
		e.rain_past_hours,
		e.rain_past_threshold_mm,
		e.weather_entity,
		e.rain_forecast_hours,
		e.rain_forecast_threshold_mm,
		_n.map((t) => {
			let n = yn(e, t.id);
			return [
				n.push,
				n.targets,
				n.priority,
				n.show_in_history
			];
		})
	]);
}
z("irrigation-settings-view", class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			snapshot: { attribute: !1 },
			_draft: { state: !0 },
			_errors: { state: !0 }
		};
	}
	constructor() {
		super(), this.baseline = "", this.saving = !1, this.lastMax = 1, this._draft = void 0, this._errors = {};
	}
	get dirty() {
		return this._draft !== void 0 && Mn(this._draft) !== this.baseline;
	}
	willUpdate(e) {
		this.snapshot && (!this._draft || e.has("snapshot") && !this.dirty && !this.saving) && this.reset(this.snapshot.settings);
	}
	reset(e) {
		this._draft = jn(e), this.baseline = Mn(e), e.global_max_valves !== null && (this.lastMax = e.global_max_valves);
	}
	patch(e) {
		if (!this._draft) return;
		this._draft = {
			...this._draft,
			...e
		};
		let t = Object.keys(e);
		this._errors = Object.fromEntries(Object.entries(this._errors).filter(([e]) => !t.some((t) => e === t || e.startsWith(`${t}.`)))), F(this, "settings-dirty", this.dirty);
	}
	async save() {
		if (this._draft && !this.saving) {
			this.saving = !0;
			try {
				let e = await We(this.hass, this._draft);
				if (e.errors.length || !e.settings) {
					this._errors = ct(this.hass, e.errors), I(this, A(this.hass, "settings_not_saved"));
					return;
				}
				this._errors = {}, this.reset(e.settings), I(this, A(this.hass, "settings_saved")), F(this, "settings-dirty", !1);
			} catch (e) {
				I(this, bt(this.hass, e));
			} finally {
				this.saving = !1;
			}
		}
	}
	toggleLimit(e) {
		let t = this._draft?.global_max_valves;
		typeof t == "number" && (this.lastMax = t), this.patch({ global_max_valves: e ? Math.max(1, this.lastMax) : null });
	}
	toggleTarget(e) {
		if (!this._draft) return;
		let t = this._draft.notify_targets;
		this.patch({ notify_targets: t.includes(e) ? t.filter((t) => t !== e) : [...t, e] });
	}
	error(e) {
		let t = this._errors[e];
		return t ? S`<div class="error-text">${t}</div>` : w;
	}
	render() {
		let e = this._draft;
		return !this.hass || !e ? w : S`${this.renderConcurrency(e)} ${this.renderNotifications(e)}
    <irrigation-alert-settings
      .hass=${this.hass}
      .settings=${e}
      .errors=${this._errors}
      @alerts-changed=${(e) => this.patch({ alerts: e.detail })}
    ></irrigation-alert-settings>
    ${this.renderRain(e)}`;
	}
	renderConcurrency(e) {
		let t = this.hass, n = e.global_max_valves !== null;
		return S`<div class="card section">
      <div class="label">${A(t, "concurrency")}</div>
      <ha-selector
        .hass=${t}
        .selector=${{ boolean: {} }}
        .label=${A(t, "limit_global")}
        .value=${n}
        @value-changed=${(e) => this.toggleLimit(B(e) ?? !1)}
      ></ha-selector>
      ${n ? S`<ha-selector
            class="narrow-field"
            .hass=${t}
            .selector=${{ number: {
			min: 1,
			max: 50,
			mode: "box"
		} }}
            .label=${A(t, "global_max")}
            .value=${e.global_max_valves}
            @value-changed=${(e) => {
			let t = Math.trunc(B(e) ?? 0);
			this.lastMax = t, this.patch({ global_max_valves: t });
		}}
          ></ha-selector>` : w}
      ${this.error("global_max_valves")}
      <div class="muted small">${A(t, "global_off_help")}</div>
    </div>`;
	}
	renderNotifications(e) {
		let t = this.hass, n = Object.keys(t.services.notify ?? {}).map((e) => `notify.${e}`).filter((e) => e.startsWith(bn)), r = [.../* @__PURE__ */ new Set([...n, ...e.notify_targets])].sort();
		return S`<div class="card section">
      <div class="label">${A(t, "notifications")}</div>
      <div class="muted small help">${A(t, "notifications_help")}</div>
      <div class="chips">
        ${r.map((t) => S`<button
              class="chip with-icon ${e.notify_targets.includes(t) ? "on" : ""}"
              title=${t}
              aria-pressed=${e.notify_targets.includes(t) ? "true" : "false"}
              @click=${() => this.toggleTarget(t)}
            >
              ${R(xn)}${Sn(t)}
            </button>`)}
      </div>
      ${e.notify_targets.map((e, t) => this.error(`notify_targets.${t}`))}
      ${r.length ? w : S`<div class="muted small">${A(t, "no_targets")}</div>`}
    </div>`;
	}
	renderRain(e) {
		let t = this.hass, n = Dn(t), r = n === "in" ? .01 : .1, i = !this._errors.rain_past_hours && !this._errors.rain_past_threshold_mm, a = !this._errors.rain_forecast_hours && !this._errors.rain_forecast_threshold_mm;
		return S`<div class="card section">
      <div class="label">${A(t, "rain")}</div>
      <div class="muted small help">${A(t, "rain_help")}</div>

      <div class="subtitle">${A(t, "rain_past")}</div>
      <ha-selector
        .hass=${t}
        .selector=${{ entity: { domain: "sensor" } }}
        .label=${A(t, "rain_sensor")}
        .required=${!1}
        .value=${e.rain_sensor ?? void 0}
        @value-changed=${(e) => this.patch({ rain_sensor: B(e) || null })}
      ></ha-selector>
      ${this.error("rain_sensor")}
      <div class="pair">
        <div>
          <ha-selector
            .hass=${t}
            .selector=${{ number: {
			min: 1,
			max: 24,
			mode: "box"
		} }}
            .label=${A(t, "rain_past_hours")}
            .value=${e.rain_past_hours}
            @value-changed=${(e) => this.patch({ rain_past_hours: Math.trunc(B(e) ?? 0) })}
          ></ha-selector>
          ${this.error("rain_past_hours")}
        </div>
        <div>
          <ha-selector
            .hass=${t}
            .selector=${{ number: {
			min: 0,
			step: r,
			mode: "box",
			unit_of_measurement: n
		} }}
            .label=${A(t, "rain_past_threshold")}
            .value=${On(e.rain_past_threshold_mm, n)}
            @value-changed=${(e) => this.patch({ rain_past_threshold_mm: kn(B(e) ?? 0, n) })}
          ></ha-selector>
          ${this.error("rain_past_threshold_mm")}
        </div>
      </div>
      ${i ? S`<div class="muted small rule">
            ${A(t, "rain_past_rule", {
			amount: On(e.rain_past_threshold_mm, n),
			unit: n,
			hours: e.rain_past_hours
		})}
          </div>` : w}

      <div class="subtitle">${A(t, "rain_forecast")}</div>
      <ha-selector
        .hass=${t}
        .selector=${{ entity: { domain: "weather" } }}
        .label=${A(t, "weather_entity")}
        .required=${!1}
        .value=${e.weather_entity ?? void 0}
        @value-changed=${(e) => this.patch({ weather_entity: B(e) || null })}
      ></ha-selector>
      ${this.error("weather_entity")}
      ${An(t, e.weather_entity) ? S`<div class="error-text">${A(t, "weather_no_hourly")}</div>` : w}
      <div class="pair">
        <div>
          <ha-selector
            .hass=${t}
            .selector=${{ number: {
			min: 6,
			max: 24,
			mode: "box"
		} }}
            .label=${A(t, "rain_forecast_hours")}
            .value=${e.rain_forecast_hours}
            @value-changed=${(e) => this.patch({ rain_forecast_hours: Math.trunc(B(e) ?? 0) })}
          ></ha-selector>
          ${this.error("rain_forecast_hours")}
        </div>
        <div>
          <ha-selector
            .hass=${t}
            .selector=${{ number: {
			min: 0,
			step: r,
			mode: "box",
			unit_of_measurement: n
		} }}
            .label=${A(t, "rain_forecast_threshold")}
            .value=${On(e.rain_forecast_threshold_mm, n)}
            @value-changed=${(e) => this.patch({ rain_forecast_threshold_mm: kn(B(e) ?? 0, n) })}
          ></ha-selector>
          ${this.error("rain_forecast_threshold_mm")}
        </div>
      </div>
      ${a ? S`<div class="muted small rule">
            ${A(t, "rain_forecast_rule", {
			amount: On(e.rain_forecast_threshold_mm, n),
			unit: n,
			hours: e.rain_forecast_hours
		})}
          </div>` : w}
    </div>`;
	}
	static {
		this.styles = [V, o`
      :host {
        display: block;
      }
      .help {
        margin-bottom: 12px;
      }
      .subtitle {
        margin: 16px 0 8px;
      }
      .narrow-field {
        max-width: 200px;
        margin-top: 12px;
      }
      .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 12px;
      }
      @media (max-width: 600px) {
        .pair {
          grid-template-columns: 1fr;
        }
      }
      .rule {
        margin-top: 4px;
      }
    `];
	}
}), z("irrigation-scheduler-panel", class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			narrow: { type: Boolean },
			_tab: { state: !0 },
			_zoneId: { state: !0 },
			_ready: { state: !0 },
			_settingsDirty: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new P(this), this.narrow = !1, this._tab = "zones", this._zoneId = void 0, this._ready = !1, this._settingsDirty = !1;
	}
	connectedCallback() {
		super.connectedCallback(), Et().then(() => {
			this._ready = !0;
		});
	}
	render() {
		if (!this.hass) return w;
		let { snapshot: e } = this.store.state;
		return this._tab === "zones" && this._zoneId !== void 0 && e && this._ready ? S`<irrigation-zone-editor
        .hass=${this.hass}
        .narrow=${this.narrow}
        .snapshot=${e}
        .zoneId=${this._zoneId}
        @zone-close=${() => {
			this._zoneId = void 0;
		}}
        @zone-saved=${(e) => {
			this._zoneId = e.detail.zoneId;
		}}
      ></irrigation-zone-editor>` : S`${this.renderToolbar()}
      <div class="content ${this._tab}">${this.renderBody()}</div>`;
	}
	renderToolbar() {
		let e = this.hass, { snapshot: t } = this.store.state, n = w;
		return this._tab === "zones" && t ? n = L(this, e, {
			action: "pause",
			run: (e) => qe(e)
		}, A(e, "pause_all")) : this._tab === "settings" && t && (n = S`<button
        class="filled"
        ?disabled=${!this._settingsDirty || !e.connected}
        @click=${this.saveSettings}
      >
        ${A(e, "save")}
      </button>`), S`<div class="toolbar">
      <ha-menu-button .hass=${e} .narrow=${this.narrow}></ha-menu-button>
      <span class="title">${A(e, "title")}</span>
      <button class="tab ${this._tab === "zones" ? "active" : ""}" @click=${() => this.selectTab("zones")}>
        ${A(e, "tab_zones")}
      </button>
      <button class="tab ${this._tab === "settings" ? "active" : ""}" @click=${() => this.selectTab("settings")}>
        ${A(e, "tab_settings")}
      </button>
      <span class="spacer"></span>
      ${n}
    </div>`;
	}
	renderBody() {
		let e = this.hass, { snapshot: t, error: n } = this.store.state;
		if (n === "not_loaded") return S`<div class="banner warning">${A(e, "not_loaded")}</div>`;
		if (n) return S`<div class="banner error">${A(e, "load_error")}</div>`;
		if (!t || !this._ready) return S`<div class="muted">${A(e, "loading")}</div>`;
		let r = e.connected ? w : S`<div class="banner error">${A(e, "disconnected")}</div>`;
		return this._tab === "settings" ? S`${r}<irrigation-settings-view
          .hass=${e}
          .snapshot=${t}
          @settings-dirty=${(e) => {
			this._settingsDirty = e.detail;
		}}
        ></irrigation-settings-view>` : S`${r}<irrigation-zone-list
        .hass=${e}
        .snapshot=${t}
        @zone-open=${(e) => {
			this._zoneId = e.detail.zoneId;
		}}
      ></irrigation-zone-list>`;
	}
	async selectTab(e) {
		e !== this._tab && (!this._settingsDirty || await H(this.hass, {
			text: A(this.hass, "confirm_discard_settings"),
			confirmText: A(this.hass, "confirm_discard_action"),
			destructive: !0
		})) && (this._settingsDirty = !1, this._zoneId = void 0, this._tab = e);
	}
	async saveSettings() {
		await this.renderRoot.querySelector("irrigation-settings-view")?.save();
	}
	static {
		this.styles = [
			V,
			Ot,
			o`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--primary-background-color);
      }
      .content {
        padding: 16px;
        max-width: 1200px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .content.settings {
        max-width: 760px;
      }
      @media (max-width: 450px) {
        /* móvil estrecho: «Pausar todo» queda solo con el icono para que quepan las pestañas */
        .toolbar {
          gap: 4px;
          padding: 0 8px;
        }
        .toolbar .title {
          margin-right: 4px;
        }
        .toolbar button .text {
          display: none;
        }
        .content {
          padding: 8px;
        }
      }
    `
		];
	}
});
//#endregion
//#region src/shared/card-config.ts
function Nn(e) {
	let t = e ?? [];
	if (!Array.isArray(t) || t.some((e) => typeof e != "string")) throw Error(A(void 0, "card_bad_zones"));
	return [...t];
}
function Pn(e, t) {
	return e.length ? e : t.map((e) => e.zone_id);
}
function Fn(e, t, n) {
	let r = {
		...t,
		...n
	};
	return r.title || delete r.title, F(e, "config-changed", { config: r }), r;
}
function In(e, t) {
	if (t.error === "not_loaded") return S`<div class="muted">${A(e, "not_loaded")}</div>`;
	if (t.error) return S`<div class="muted">${A(e, "load_error")}</div>`;
	if (!t.snapshot) return S`<div class="muted">${A(e, "loading")}</div>`;
}
function Ln(e, t, n, r) {
	let i = (e) => t.find((t) => t.zone_id === e)?.name ?? e, a = t.filter((e) => !n.includes(e.zone_id));
	return S`<div class="section">
    <div class="label">${A(e, "card_zones")}</div>
    <div class="chips zone-chips">
      ${n.map((e) => S`<button class="chip on" @click=${() => r(n.filter((t) => t !== e))}>
            ${i(e)} ✕
          </button>`)}
      ${a.length ? S`<select @change=${(e) => {
		let t = e.target, i = t.value;
		t.value = "", i && r([...n, i]);
	}}>
            <option value="" selected>${A(e, "add_zone")}</option>
            ${a.map((e) => S`<option .value=${e.zone_id}>${e.name}</option>`)}
          </select>` : w}
    </div>
    <div class="muted small">${A(e, n.length ? "card_order_help" : "card_all_zones")}</div>
  </div>`;
}
function Rn(e, t, n) {
	return S`<ha-selector
    .hass=${e}
    .selector=${{ text: {} }}
    .label=${A(e, "card_title")}
    .required=${!1}
    .value=${t ?? ""}
    @value-changed=${(e) => n(B(e) ?? "")}
  ></ha-selector>`;
}
var zn = o`
  .zone-chips {
    margin-bottom: 4px;
  }
`, Bn = "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z", J = "irrigation-scheduler-card", Vn = 3e3;
z(J, class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			_config: { state: !0 },
			_expanded: { state: !0 },
			_editing: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new P(this), this.hass = void 0, this._config = void 0, this._expanded = /* @__PURE__ */ new Set(), this._editing = void 0, new mt(this);
	}
	setConfig(e) {
		this._config = {
			...e,
			zones: Nn(e?.zones)
		};
	}
	getCardSize() {
		return 1 + (this._config?.zones.length || this.store.state.snapshot?.zones.length || 1);
	}
	static getConfigElement() {
		return document.createElement(`${J}-editor`);
	}
	static async getStubConfig(e) {
		let t = [];
		try {
			let n = new Promise((e, t) => window.setTimeout(() => t(/* @__PURE__ */ Error("timeout")), Vn));
			t = (await Promise.race([Ve(e), n])).zones.slice(0, 3).map((e) => e.zone_id);
		} catch {}
		return {
			type: `custom:${J}`,
			zones: t
		};
	}
	toggle(e) {
		let t = new Set(this._expanded);
		t.has(e) ? t.delete(e) : t.add(e), this._expanded = t;
	}
	async openEditor(e) {
		await Et(), this._editing = e;
	}
	updated() {
		let e = this.renderRoot.querySelector("dialog.editor");
		e && !e.open && e.showModal();
	}
	renderEditor(e, t) {
		return S`<dialog
      class="editor"
      @cancel=${(e) => {
			e.preventDefault(), this.renderRoot.querySelector("irrigation-zone-editor")?.back();
		}}
    >
      <irrigation-zone-editor
        hide-controls
        .hass=${e}
        .snapshot=${t}
        .zoneId=${this._editing}
        @zone-close=${(e) => {
			e.stopPropagation(), this._editing = void 0;
		}}
        @zone-saved=${(e) => {
			e.stopPropagation(), this._editing = e.detail.zoneId;
		}}
      ></irrigation-zone-editor>
    </dialog>`;
	}
	render() {
		let e = this._config, t = this.hass;
		if (!e || !t) return w;
		let { snapshot: n } = this.store.state, r = In(t, this.store.state);
		if (!r && n) {
			let i = Pn(e.zones, n.zones);
			r = i.length ? i.map((e) => this.renderZone(t, n, e)) : S`<div class="muted">${A(t, "empty_list")}</div>`;
		}
		return S`<ha-card .header=${e.title}>
      <div class="card-content">
        ${n && !t.connected ? S`<div class="banner error">${A(t, "disconnected")}</div>` : w}
        ${r}
        ${n ? S`<div class="footer">
              <button ?disabled=${!t.connected} @click=${() => this.openEditor(null)}>${A(t, "add_zone")}</button>
            </div>` : w}
      </div>
      ${n && this._editing !== void 0 ? this.renderEditor(t, n) : w}
    </ha-card>`;
	}
	renderZone(e, t, n) {
		let r = t.zones.find((e) => e.zone_id === n);
		if (!r) return S`<div class="zone-row muted">⚠ ${A(e, "zone_not_found")}</div>`;
		let i = Jt(r, t), a = this._expanded.has(n), o = i === "running" ? Qt(r, t) : void 0, s = i === "running" ? Zt(r) : void 0;
		return S`<div class="zone ${i === "stopped" ? "stopped" : ""}">
      <div class="zone-row" @click=${() => this.toggle(n)}>
        <button
          class="icon expand"
          aria-expanded=${a ? "true" : "false"}
          @click=${(e) => {
			e.stopPropagation(), this.toggle(n);
		}}
        >
          ${R(a ? gt : ht)}
        </button>
        <span class="icon">${Kt[i]}</span>
        <div class="main">
          <div class="name">${r.name}</div>
          <div class="small muted">${this.zoneLine(e, r, i, o, s)}</div>
          ${s && r.valves.length > 1 ? Bt(s) : w}
        </div>
        <div class="buttons">
          ${$t(r, i).map((t) => L(this, e, t))}
          <button
            class="icon configure"
            title=${A(e, "configure_zone")}
            aria-label=${A(e, "configure_zone")}
            @click=${(e) => {
			e.stopPropagation(), this.openEditor(r.zone_id);
		}}
          >
            ${R(Bn)}
          </button>
        </div>
      </div>
      ${a ? S`<div class="valves">${r.valves.map((n) => Ut(this, e, t, n))}</div>` : w}
    </div>`;
	}
	zoneLine(e, t, n, r, i) {
		switch (n) {
			case "running":
				if (i) {
					let t = N(zt(i));
					return `${A(e, "batch")} · ${A(e, "remaining", { time: t })}`;
				}
				return r && !r.open ? `${r.valve.name} · ${A(e, "status_manual")}` : A(e, "status_running");
			case "queued": return A(e, "status_queued");
			case "idle": return `${A(e, "status_idle")} · ${at(e, t.next_run)}`;
			case "stopped": return A(e, "status_stopped");
		}
	}
	static {
		this.styles = [
			V,
			Wt,
			o`
      .card-content {
        padding: 0 16px 8px;
      }
      ha-card:not([header]) .card-content {
        padding-top: 8px;
      }
      .zone-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        cursor: pointer;
      }
      .zone + .zone {
        border-top: 1px solid var(--divider-color);
      }
      .stopped {
        opacity: 0.6;
      }
      .icon {
        width: 24px;
        text-align: center;
      }
      .main {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-weight: 500;
      }
      .buttons {
        display: flex;
        gap: 4px;
        /* en tarjetas estrechas encoge el texto, no los botones */
        flex: none;
      }
      button.expand {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
        padding: 0;
        color: var(--secondary-text-color);
      }
      button.expand .svg-icon {
        width: 28px;
        height: 28px;
      }
      button.configure {
        display: flex;
        align-items: center;
        color: var(--secondary-text-color);
      }
      .footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 8px;
        border-top: 1px solid var(--divider-color);
      }
      dialog.editor {
        padding: 0;
        border: none;
        width: min(1200px, calc(100vw - 32px));
        max-width: none;
        height: calc(100vh - 64px);
        max-height: none;
        border-radius: var(--ha-dialog-border-radius, 24px);
        background: var(--primary-background-color);
        overflow: auto;
      }
      dialog.editor::backdrop {
        background: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.32));
      }
      dialog.editor irrigation-zone-editor {
        /* el editor ocupa 100vh en el panel; aquí se ajusta al diálogo */
        min-height: 100%;
      }
      @media (max-width: 600px) {
        dialog.editor {
          width: 100vw;
          height: 100vh;
          border-radius: 0;
        }
      }
      .valves {
        /* sangría = botón de desplegar + hueco: el icono de la válvula cae bajo el de la zona */
        padding: 0 0 8px 48px;
      }
    `
		];
	}
}), Dt({
	type: J,
	name: "Irrigation Scheduler",
	description: A(void 0, "card_description"),
	preview: !0
});
//#endregion
//#region src/card/card-editor.ts
var Hn = class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			_config: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new P(this), this.hass = void 0, this._config = void 0;
	}
	connectedCallback() {
		super.connectedCallback(), Et().then(() => this.requestUpdate());
	}
	setConfig(e) {
		this._config = {
			...e,
			zones: Array.isArray(e.zones) ? [...e.zones] : []
		};
	}
	changeConfig(e) {
		this._config &&= Fn(this, this._config, e);
	}
	render() {
		let e = this.hass, t = this._config;
		return !e || !t ? w : S`
      ${Ln(e, this.store.state.snapshot?.zones ?? [], t.zones, (e) => this.changeConfig({ zones: e }))}
      ${Rn(e, t.title, (e) => this.changeConfig({ title: e }))}
    `;
	}
	static {
		this.styles = [
			V,
			zn,
			o`
      :host {
        display: block;
      }
    `
		];
	}
};
z(`${J}-editor`, Hn);
//#endregion
//#region src/shared/history-marks.ts
function Un(e, t, n) {
	let r = [];
	for (let i of e) {
		let e = Date.parse(i.s), a = _n.find((e) => e.id === i.a?.event_type);
		!a || Number.isNaN(e) || e < n.start || e > n.end || yn(t, a.id).show_in_history && r.push({
			type: a,
			at: e
		});
	}
	return r;
}
function Wn(e, t, n, r, i) {
	let a = (t) => t ? Un(e[t] ?? [], r, i) : [];
	return {
		installation: a(n),
		zones: Object.fromEntries(t.map((e) => [e.zone_id, {
			zone: a(e.entities.alerts),
			valves: Object.fromEntries(e.valves.map((t) => [t.entity_id, a(e.entities.valves[t.entity_id]?.alerts)]))
		}]))
	};
}
function Gn(e, t) {
	return [t, ...e.flatMap((e) => [e.entities.alerts, ...e.valves.map((t) => e.entities.valves[t.entity_id]?.alerts)])].filter((e) => !!e);
}
var Y = 36e5, X = 24 * Y, Kn = 7 * X, Z = {
	kind: "relative",
	amount: 24,
	unit: "hours"
}, qn = [
	{
		kind: "relative",
		amount: 6,
		unit: "hours"
	},
	Z,
	{
		kind: "relative",
		amount: 3,
		unit: "days"
	},
	{
		kind: "relative",
		amount: 7,
		unit: "days"
	}
];
function Jn(e, t) {
	return e.amount === t.amount && e.unit === t.unit;
}
function Yn(e) {
	return e === "days" ? 7 : 168;
}
function Xn(e) {
	let { amount: t, unit: n } = e ?? {};
	return n !== "hours" && n !== "days" || typeof t != "number" || !Number.isInteger(t) || t < 1 || t > Yn(n) ? Z : {
		kind: "relative",
		amount: t,
		unit: n
	};
}
function Q(e, t) {
	if (e.kind === "relative") {
		let n = e.amount * (e.unit === "days" ? X : Y);
		return {
			start: t - (n > 0 ? Math.min(n, Kn) : Y * Z.amount),
			end: t
		};
	}
	let n = Math.min(Date.parse(e.end), t), r = Math.max(Date.parse(e.start), t - Kn, n - Kn);
	return r < n ? {
		start: r,
		end: n
	} : Q(Z, t);
}
function Zn(e, t) {
	let n = new Intl.DateTimeFormat("en-US", {
		timeZone: t,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	}).formatToParts(new Date(e)), r = (e) => Number(n.find((t) => t.type === e)?.value);
	return Date.UTC(r("year"), r("month") - 1, r("day"), r("hour"), r("minute"), r("second")) - Math.floor(e / 1e3) * 1e3;
}
function Qn(e, t) {
	let n = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e);
	if (!n) return;
	let [, r, i, a, o, s] = n.map(Number), c = Date.UTC(r, i - 1, a, o, s), l = c - Zn(c, t);
	return new Date(c - Zn(l, t)).toISOString();
}
function $n(e, t) {
	return new Date(e + Zn(e, t)).toISOString().slice(0, 16);
}
var er = [
	1,
	2,
	3,
	6,
	12
], tr = 6;
function nr(e, t) {
	let n = e.end - e.start, r = n > X, i = (r ? 24 : er.find((e) => n / (e * Y) <= tr) ?? 12) * Y, a = Zn(e.start, t), o = [];
	for (let t = Math.ceil((e.start + a) / i) * i; t - a <= e.end; t += i) o.push({
		at: t - a,
		parts: r ? "day" : "time"
	});
	return o;
}
var rr = .15;
function ir(e, t) {
	let n = e.end - e.start;
	if (n > X) return [];
	let r = Zn(e.start, t), i = [];
	for (let t = Math.ceil((e.start + r) / X) * X; t - r <= e.end; t += X) i.push({
		at: t - r,
		x: (t - r - e.start) / n,
		midnight: !0
	});
	return (!i.length || i[0].x >= rr) && i.unshift({
		at: e.start,
		x: 0,
		midnight: !1
	}), i;
}
//#endregion
//#region src/shared/valve-history.ts
var ar = [
	"scheduled",
	"manual",
	"external"
], or = "on";
function sr(e, t) {
	let n = [], r, i = (e, i) => {
		if (r === void 0) return;
		let a = Math.max(r, t.start), o = Math.min(e, t.end);
		o > a && n.push({
			started_at: new Date(a).toISOString(),
			ends_at: new Date(o).toISOString(),
			seconds: (o - a) / 1e3,
			ongoing: i,
			startsBefore: r <= t.start
		}), r = void 0;
	};
	for (let t of e) {
		let e = (t.lc ?? t.lu) * 1e3;
		t.s === or ? r ??= e : i(e, !1);
	}
	return i(t.end, !0), n.reverse();
}
function cr(e, t, n) {
	let r = Date.parse(e.started_at), i = Date.parse(e.ends_at);
	for (let e = 0; e < t.length; e++) {
		let a = (t[e].lc ?? t[e].lu) * 1e3, o = t[e + 1], s = o ? (o.lc ?? o.lu) * 1e3 : n.end;
		if (ar.includes(t[e].s) && a < i && s > r) return t[e].s;
	}
}
var lr = (e) => e.reduce((e, t) => e + t.seconds, 0);
function ur(e, t, n) {
	return t.map((t) => {
		let r = t.valves.map((r) => {
			let i = t.entities.valves[r.entity_id]?.mode, a = i ? e[i] ?? [] : [], o = sr(e[r.entity_id] ?? [], n).map((e) => ({
				...e,
				origin: cr(e, a, n)
			}));
			return {
				valve: r,
				runs: o,
				seconds: lr(o)
			};
		}), i = r.reduce((e, t) => e + t.runs.length, 0);
		return {
			zone: t,
			valves: r,
			seconds: lr(r),
			count: i
		};
	});
}
//#endregion
//#region src/shared/alert-icons.ts
var dr = "M9 8H11V14H9V8M13 1H7V3H13V1M17.03 7.39C18.26 8.93 19 10.88 19 13C19 17.97 15 22 10 22C5.03 22 1 17.97 1 13S5.03 4 10 4C12.12 4 14.07 4.74 15.62 6L17.04 4.56C17.55 5 18 5.46 18.45 5.97L17.03 7.39M17 13C17 9.13 13.87 6 10 6S3 9.13 3 13 6.13 20 10 20 17 16.87 17 13M21 7V13H23V7H21M21 17H23V15H21V17Z", fr = {
	turn_on_failed: {
		icon: "M20.84 22.73L16.29 18.18C15.2 19.3 13.69 20 12 20C8.69 20 6 17.31 6 14C6 12.67 6.67 11.03 7.55 9.44L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M18 14C18 10 12 3.25 12 3.25S10.84 4.55 9.55 6.35L17.95 14.75C18 14.5 18 14.25 18 14Z",
		color: "error"
	},
	turn_off_failed: {
		icon: "M10 3.25C10 3.25 16 10 16 14C16 17.31 13.31 20 10 20S4 17.31 4 14C4 10 10 3.25 10 3.25M20 7V13H18V7H20M18 17H20V15H18V17Z",
		color: "error"
	},
	overrun_restart: {
		icon: dr,
		color: "warning"
	},
	overrun_running: {
		icon: dr,
		color: "warning"
	},
	manual_overrun: {
		icon: "M21 7C21 5.62 19.88 4.5 18.5 4.5C18.33 4.5 18.16 4.5 18 4.55V4C18 2.62 16.88 1.5 15.5 1.5C15.27 1.5 15.04 1.53 14.83 1.59C14.46 .66 13.56 0 12.5 0C11.27 0 10.25 .89 10.04 2.06C9.87 2 9.69 2 9.5 2C8.12 2 7 3.12 7 4.5V10.39C6.66 10.08 6.24 9.85 5.78 9.73L5 9.5C4.18 9.29 3.31 9.61 2.82 10.35C2.44 10.92 2.42 11.66 2.67 12.3L5.23 18.73C6.5 21.91 9.57 24 13 24C17.42 24 21 20.42 21 16V7M19 16C19 19.31 16.31 22 13 22C10.39 22 8.05 20.41 7.09 18L4.5 11.45L5 11.59C5.5 11.71 5.85 12.05 6 12.5L7 15H9V4.5C9 4.22 9.22 4 9.5 4S10 4.22 10 4.5V12H12V2.5C12 2.22 12.22 2 12.5 2S13 2.22 13 2.5V12H15V4C15 3.72 15.22 3.5 15.5 3.5S16 3.72 16 4V12H18V7C18 6.72 18.22 6.5 18.5 6.5S19 6.72 19 7V16Z",
		color: "warning"
	},
	sensor_unavailable: {
		icon: "M14.83,13.83C15.55,13.11 16,12.11 16,11C16,9.89 15.55,8.89 14.83,8.17L16.24,6.76C17.33,7.85 18,9.35 18,11C18,12.65 17.33,14.15 16.24,15.24L14.83,13.83M14,11A2,2 0 0,0 12,9C11.4,9 10.87,9.27 10.5,9.68L13.32,12.5C13.73,12.13 14,11.6 14,11M17.66,16.66L19.07,18.07C20.88,16.26 22,13.76 22,11C22,8.24 20.88,5.74 19.07,3.93L17.66,5.34C19.11,6.78 20,8.79 20,11C20,13.22 19.11,15.22 17.66,16.66M22,21.18V20H20.82L22,21.18M20.27,22L21,22.73L19.73,24L17.73,22H15A1,1 0 0,1 14,23H10A1,1 0 0,1 9,22H2V20H9A1,1 0 0,1 10,19H11V15.27L8.34,12.61C8.54,13.07 8.82,13.5 9.17,13.83L7.76,15.24C6.67,14.15 6,12.65 6,11C6,10.77 6,10.54 6.04,10.31L4.37,8.64C4.14,9.39 4,10.18 4,11C4,13.22 4.89,15.22 6.34,16.66L4.93,18.07C3.12,16.26 2,13.76 2,11C2,9.61 2.29,8.28 2.81,7.08L1,5.27L2.28,4L3.7,5.42L5.15,6.87L6.63,8.35V8.35L8.17,9.9L10.28,12L11,12.71L18.27,20H18.28L20.28,22H20.27M15.73,20L13,17.27V19H14A1,1 0 0,1 15,20H15.73Z",
		color: "warning"
	},
	rain_skipped: {
		icon: "M9,12C9.53,12.14 9.85,12.69 9.71,13.22L8.41,18.05C8.27,18.59 7.72,18.9 7.19,18.76C6.65,18.62 6.34,18.07 6.5,17.54L7.78,12.71C7.92,12.17 8.47,11.86 9,12M13,12C13.53,12.14 13.85,12.69 13.71,13.22L11.64,20.95C11.5,21.5 10.95,21.8 10.41,21.66C9.88,21.5 9.56,20.97 9.7,20.43L11.78,12.71C11.92,12.17 12.47,11.86 13,12M17,12C17.53,12.14 17.85,12.69 17.71,13.22L16.41,18.05C16.27,18.59 15.72,18.9 15.19,18.76C14.65,18.62 14.34,18.07 14.5,17.54L15.78,12.71C15.92,12.17 16.47,11.86 17,12M17,10V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.43 4,15.6 3.5,15.32V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12C23,13.5 22.2,14.77 21,15.46V15.46C20.5,15.73 19.91,15.57 19.63,15.09C19.36,14.61 19.5,14 20,13.72V13.73C20.6,13.39 21,12.74 21,12A2,2 0 0,0 19,10H17Z",
		color: "info"
	},
	rain_source_unavailable: {
		icon: "M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13M13,12H11V8H13V12M13,16H11V14H13",
		color: "warning"
	}
}, pr = 6;
function mr(e) {
	return e ? S`<div class="tip" role="tooltip">
    <div class="tip-title">${e.title}</div>
    ${e.lines.map((e) => S`<div class="small">${e}</div>`)}
  </div>` : w;
}
function hr(e, t, n) {
	let r = t.getBoundingClientRect(), i = n.getBoundingClientRect(), a = e.offsetWidth, o = r.left + r.width / 2 - i.left, s = Math.min(Math.max(o - a / 2, 0), Math.max(n.clientWidth - a, 0)), c = r.top - i.top - pr - e.offsetHeight;
	e.style.left = `${s}px`, e.style.top = `${c >= 0 ? c : r.bottom - i.top + pr}px`;
}
function gr(e, t) {
	return {
		enter: (n) => {
			n.pointerType === "mouse" && e(n.currentTarget, t);
		},
		leave: (t) => {
			t.pointerType === "mouse" && e(t.currentTarget);
		},
		click: (n) => {
			n.stopPropagation(), e(n.currentTarget, t);
		}
	};
}
var _r = o`
  .tip {
    position: absolute;
    z-index: 2;
    max-width: 240px;
    padding: 6px 10px;
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.25));
    pointer-events: none;
  }
  .tip-title {
    font-weight: 500;
  }
`, vr = ["timeline", "totals"], yr = {
	timeline: "history_view_timeline",
	totals: "history_view_totals"
}, br = .6, xr = .85, Sr = (e) => vr.includes(e) ? e : "timeline";
function Cr(e, t, n) {
	return S`<div class="chips">
    ${vr.map((r) => S`<button class="chip ${r === t ? "on" : ""}" @click=${() => n(r)}>
          ${A(e, yr[r])}
        </button>`)}
  </div>`;
}
var wr = (e, t) => t === 1 ? A(e, "history_runs_one") : A(e, "history_runs", { n: t }), Tr = (e) => S`<div class="muted small empty">${A(e, "history_empty")}</div>`;
function Er(e, t, n) {
	let r = Date.parse(t.started_at), i = Date.parse(t.ends_at), a = `${t.startsBefore ? "← " : ""}${M(e, r)}`;
	return t.ongoing && n ? `${a} → ${A(e, "history_ongoing")}` : `${a} → ${M(e, i, ot(e, r, i) ? "time" : "full")}${t.ongoing ? " →" : ""}`;
}
var Dr = {
	scheduled: "history_run_scheduled",
	manual: "history_run_manual",
	external: "history_run_external"
};
function Or(e, t, n) {
	let r = [Er(e, t, n), A(e, "history_watered", { time: N(t.seconds) })];
	return t.startsBefore && r.push(A(e, "history_before_window")), {
		title: A(e, t.origin ? Dr[t.origin] : "history_run"),
		lines: r
	};
}
var kr = (e, t) => ({
	title: A(e, t.type.name),
	lines: [M(e, t.at)]
}), Ar = (e, t) => (t - e.start) / (e.end - e.start) * 100;
function jr(e, t, n, r, i, a) {
	let o = nr(r, e.config.time_zone), s = (t) => t.map((t) => {
		let n = Ar(r, Date.parse(t.started_at)), o = Math.max(br, Ar(r, Date.parse(t.ends_at)) - n), s = gr(a, Or(e, t, i));
		return we`<rect class=${t.ongoing ? "ongoing" : ""} x=${n} y="0" width=${o} height="10"
        @pointerenter=${s.enter} @pointerleave=${s.leave} @click=${s.click}></rect>`;
	}), c = (t) => t.map((t) => {
		let n = fr[t.type.id], i = gr(a, kr(e, t));
		return S`<button
        class="tl-mark ${n.color}"
        style=${Ft({ left: `${Ar(r, t.at)}%` })}
        aria-label=${A(e, t.type.name)}
        @pointerenter=${i.enter}
        @pointerleave=${i.leave}
        @click=${i.click}
      >
        ${R(n.icon)}
      </button>`;
	}), l = o.map((e) => {
		let t = Ar(r, e.at);
		return we`<line x1=${t} x2=${t} y1="0" y2="10"></line>`;
	}), u = (e, t, n, r = "") => S`<div class="tl-row ${r}">
    <span class="tl-label small">${e}</span>
    <div class="tl-lane">
      <svg class="tl-bars" viewBox="0 0 100 10" preserveAspectRatio="none">${l}${s(t)}</svg>
      ${c(n)}
    </div>
  </div>`, d = ({ zone: t, valves: r }) => {
		let i = n.zones[t.zone_id], a = (e) => i?.valves[e.valve.entity_id] ?? [], o = r.filter((e) => e.runs.length || a(e).length);
		return S`${i?.zone.length ? u(t.name, [], i.zone, "tl-zone") : S`<div class="tl-zone">${t.name}</div>`}
      ${o.length ? o.map((e) => u(e.valve.name, e.runs, a(e))) : Tr(e)}`;
	}, f = ir(r, e.config.time_zone);
	return S`${f.length ? S`<div class="tl-row tl-days">
          <span></span>
          <div class="tl-track">
            ${f.map((t) => S`<span
                  class="tl-day small muted ${t.midnight && t.x <= xr ? "midnight" : ""}"
                  style=${Ft(t.x > xr ? { right: "0" } : { left: `${t.x * 100}%` })}
                >
                  ${M(e, t.at, "day")}
                </span>`)}
          </div>
        </div>` : w}
    <div class="tl-row tl-axis">
      <span></span>
      <div class="tl-track">
        ${o.map((t) => S`<span class="tl-tick small muted" style=${Ft({ left: `${Ar(r, t.at)}%` })}>
              ${M(e, t.at, t.parts)}
            </span>`)}
      </div>
    </div>
    ${n.installation.length ? u(A(e, "history_installation"), [], n.installation, "tl-zone") : w}
    ${t.map(d)}`;
}
function Mr(e, t) {
	return S`<div class="totals">
    ${t.map(({ zone: t, valves: n, seconds: r, count: i }) => S`<span class="t-zone">${t.name}</span>
          <span class="t-zone">${wr(e, i)}</span>
          <span class="t-zone t-time">${N(r)}</span>
          ${n.map((e) => S`<span class="t-valve">${e.valve.name}</span>
                <span class="muted">${e.runs.length}</span>
                <span class="t-time">${N(e.seconds)}</span>`)}`)}
  </div>`;
}
var Nr = o`
  .empty {
    padding: 4px 0 8px 28px;
  }
  .tl-row {
    display: grid;
    grid-template-columns: minmax(0, 35%) 1fr;
    gap: 8px;
    align-items: center;
    padding: 2px 0;
  }
  .tl-track {
    position: relative;
    height: 1.4em;
  }
  .tl-tick {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .tl-day {
    position: absolute;
    white-space: nowrap;
  }
  .tl-day.midnight {
    padding-left: 4px;
    border-left: 1px solid var(--divider-color);
  }
  .tl-zone {
    font-weight: 500;
    margin-top: 8px;
  }
  .tl-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tl-bars {
    display: block;
    width: 100%;
    height: 12px;
    border-radius: 2px;
    background: var(--secondary-background-color);
  }
  .tl-bars rect {
    fill: var(--primary-color);
  }
  .tl-bars rect.ongoing {
    fill: var(--accent-color);
  }
  .tl-bars line {
    stroke: var(--divider-color);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .tl-lane {
    position: relative;
  }
  .tl-bars rect {
    cursor: pointer;
  }
  button.tl-mark {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    min-width: 0;
    min-height: 0;
    padding: 2px;
    border: none;
    border-radius: 50%;
    background: var(--card-background-color);
    line-height: 0;
  }
  button.tl-mark .svg-icon {
    width: 16px;
    height: 16px;
  }
  button.tl-mark.error {
    color: var(--error-color);
  }
  button.tl-mark.warning {
    color: var(--warning-color);
  }
  button.tl-mark.info {
    color: var(--info-color);
  }
  .totals {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 4px 12px;
  }
  .t-zone {
    font-weight: 500;
    margin-top: 8px;
  }
  .t-valve {
    padding-left: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .t-time {
    text-align: right;
  }
`, Pr = jt(class extends Mt {
	constructor(e) {
		if (super(e), e.type !== U.PROPERTY && e.type !== U.ATTRIBUTE && e.type !== U.BOOLEAN_ATTRIBUTE) throw Error("The `live` directive is not allowed on child or event bindings");
		if (!nn(e)) throw Error("`live` bindings can only contain a single expression");
	}
	render(e) {
		return e;
	}
	update(e, [t]) {
		if (t === C || t === w) return t;
		let n = e.element, r = e.name;
		if (e.type === U.PROPERTY) {
			if (t === n[r]) return C;
		} else if (e.type === U.BOOLEAN_ATTRIBUTE) {
			if (!!t === n.hasAttribute(r)) return C;
		} else if (e.type === U.ATTRIBUTE && n.getAttribute(r) === t + "") return C;
		return on(e), t;
	}
}), Fr = ["hours", "days"], Ir = {
	hours: "history_unit_hours",
	days: "history_unit_days"
}, Lr = {
	hours: "history_hours",
	days: "history_days"
};
z("irrigation-window-picker", class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			window: { attribute: !1 },
			allowCustom: {
				type: Boolean,
				attribute: "allow-custom"
			},
			allowRange: {
				type: Boolean,
				attribute: "allow-range"
			},
			_custom: { state: !0 }
		};
	}
	constructor() {
		super(), this.hass = void 0, this.window = Z, this.allowCustom = !1, this.allowRange = !1, this._custom = !1;
	}
	mode() {
		let e = this.window;
		return e.kind === "range" ? "range" : this._custom || !qn.some((t) => Jn(t, e)) ? "custom" : "preset";
	}
	emit(e) {
		F(this, "window-changed", { window: e }), this.requestUpdate();
	}
	pickPreset(e) {
		this._custom = !1, this.emit(e);
	}
	pickCustom() {
		this._custom = !0, this.window.kind === "range" && this.emit(Z);
	}
	pickRange() {
		this._custom = !1;
		let e = Q(Z, Date.now());
		this.emit({
			kind: "range",
			start: new Date(e.start).toISOString(),
			end: new Date(e.end).toISOString()
		});
	}
	changeCustom(e, t) {
		let n = Math.min(Math.max(1, Math.round(e) || 1), Yn(t));
		this.emit({
			kind: "relative",
			amount: n,
			unit: t
		});
	}
	changeRange(e, t, n) {
		if (!this.hass) return;
		let r = Qn(n, this.hass.config.time_zone);
		r && this.emit({
			...e,
			[t]: r
		});
	}
	render() {
		let e = this.hass;
		if (!e) return w;
		let t = this.mode(), n = this.window, r = (e, t, n) => S`<button class="chip ${e ? "on" : ""}" @click=${n}>${t}</button>`;
		return S`<div class="chips">
        ${qn.map((i) => r(t === "preset" && n.kind === "relative" && Jn(i, n), A(e, Lr[i.unit], { n: i.amount }), () => this.pickPreset(i)))}
        ${this.allowCustom ? r(t === "custom", A(e, "history_custom"), () => this.pickCustom()) : w}
        ${this.allowRange ? r(t === "range", A(e, "history_range"), () => this.pickRange()) : w}
      </div>
      ${this.allowCustom && t === "custom" && n.kind === "relative" ? this.renderCustom(e, n) : w}
      ${n.kind === "range" ? this.renderRange(e, n) : w}`;
	}
	renderCustom(e, t) {
		return S`<div class="row edit">
      <input
        type="number"
        min="1"
        max=${Yn(t.unit)}
        .value=${Pr(String(t.amount))}
        @change=${(e) => this.changeCustom(Number(e.target.value), t.unit)}
      />
      <select
        @change=${(e) => this.changeCustom(t.amount, e.target.value)}
      >
        ${Fr.map((n) => S`<option .value=${n} ?selected=${n === t.unit}>${A(e, Ir[n])}</option>`)}
      </select>
    </div>`;
	}
	renderRange(e, t) {
		let n = e.config.time_zone, r = Date.now(), i = Q(t, r), a = $n(r - Kn, n), o = $n(r, n), s = (e, r, i) => S`<label class="row">
        <span class="small muted">${r}</span>
        <input
          type="datetime-local"
          min=${a}
          max=${o}
          .value=${Pr($n(i, n))}
          @change=${(n) => this.changeRange(t, e, n.target.value)}
        />
      </label>`;
		return S`<div class="row edit">
      ${s("start", A(e, "history_from"), i.start)} ${s("end", A(e, "history_to"), i.end)}
    </div>`;
	}
	static {
		this.styles = [V, o`
      :host {
        display: block;
      }
      .edit {
        margin-top: 8px;
      }
      input[type="number"] {
        width: 5em;
      }
    `];
	}
});
//#endregion
//#region src/card/history-card.ts
var $ = "irrigation-history-card", Rr = 2e3;
z($, class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			_config: { state: !0 },
			_view: { state: !0 },
			_window: { state: !0 },
			_history: { state: !0 },
			_alerts: { state: !0 },
			_error: { state: !0 },
			_tip: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new P(this), this.seq = 0, this.onTip = (e, t) => {
			t ? (this.tipTarget = e, this._tip = t) : e === this.tipTarget && this.closeTip();
		}, this.onWindowClick = (e) => {
			this._tip && !e.composedPath().includes(this) && this.closeTip();
		}, this.hass = void 0, this._config = void 0, this._view = "timeline", this._window = Xn(void 0), this._history = void 0, this._alerts = {}, this._error = !1, this._tip = void 0, new mt(this);
	}
	setConfig(e) {
		this._config = {
			...e,
			zones: Nn(e?.zones)
		}, this._view = Sr(e?.view), this._window = Xn(e?.window);
	}
	getCardSize() {
		return 4;
	}
	static getConfigElement() {
		return document.createElement(`${$}-editor`);
	}
	static getStubConfig() {
		return {
			type: `custom:${$}`,
			zones: []
		};
	}
	closeTip() {
		this._tip = void 0, this.tipTarget = void 0;
	}
	connectedCallback() {
		super.connectedCallback(), window.addEventListener("click", this.onWindowClick);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("click", this.onWindowClick), this.closeTip(), window.clearTimeout(this.reloadTimer), this.fetchKey = void 0;
	}
	zones(e) {
		return Pn(this._config?.zones ?? [], e.zones).flatMap((t) => e.zones.filter((e) => e.zone_id === t));
	}
	positionTip() {
		if (!this._tip || !this.tipTarget) return;
		if (!this.tipTarget.isConnected) {
			this.closeTip();
			return;
		}
		let e = this.renderRoot.querySelector(".tip"), t = this.renderRoot.querySelector(".card-content");
		e && t && hr(e, this.tipTarget, t);
	}
	updated() {
		this.positionTip();
		let e = this.store.state.snapshot;
		if (!this.hass || !this._config || !e) return;
		let t = this.zones(e), n = t.flatMap((e) => e.valves.flatMap((t) => {
			let n = e.entities.valves[t.entity_id]?.mode;
			return n ? [t.entity_id, n] : [t.entity_id];
		})), r = Gn(t, e.installation_alerts), i = `${n.join(",")}|${r.join(",")}|${JSON.stringify(this._window)}`;
		if (i !== this.fetchKey) {
			this.fetchKey = i, this.lastSnapshot = e, this.load(n, r, !0);
			return;
		}
		e !== this.lastSnapshot && (this.lastSnapshot = e, this._window.kind === "relative" && this.scheduleReload(n, r));
	}
	scheduleReload(e, t) {
		window.clearTimeout(this.reloadTimer), this.reloadTimer = window.setTimeout(() => void this.load(e, t, !1), Rr);
	}
	async load(e, t, n) {
		let r = this.hass;
		if (!r) return;
		window.clearTimeout(this.reloadTimer);
		let i = ++this.seq;
		n && (this._history = void 0);
		let a = Q(this._window, Date.now());
		try {
			let [n, o] = await Promise.all([e.length ? Ze(r, e, a.start, a.end) : Promise.resolve({}), t.length ? Qe(r, t, a.start, a.end).catch(() => ({})) : Promise.resolve({})]);
			if (i !== this.seq) return;
			this._history = n, this._alerts = o, this._error = !1;
		} catch {
			i === this.seq && (this._error = !0);
		}
	}
	render() {
		let e = this._config, t = this.hass;
		if (!e || !t) return w;
		let { snapshot: n } = this.store.state, r = In(t, this.store.state) ?? (n ? this.renderHistory(t, n) : w);
		return S`<ha-card .header=${e.title} @click=${() => this.closeTip()}>
      <div class="card-content">
        ${n && !t.connected ? S`<div class="banner error">${A(t, "disconnected")}</div>` : w}
        ${Cr(t, this._view, (e) => {
			this._view = e, this.closeTip();
		})}
        <irrigation-window-picker
          allow-range
          .hass=${t}
          .window=${this._window}
          @window-changed=${(e) => {
			this._window = e.detail.window;
		}}
        ></irrigation-window-picker>
        <div class="view">${r}</div>
        ${mr(this._tip)}
      </div>
    </ha-card>`;
	}
	renderHistory(e, t) {
		if (this._error) return S`<div class="muted">${A(e, "history_unavailable")}</div>`;
		if (!this._history) return S`<div class="muted">${A(e, "loading")}</div>`;
		let n = this.zones(t);
		if (!n.length) return S`<div class="muted">${A(e, "empty_list")}</div>`;
		let r = Q(this._window, Date.now()), i = ur(this._history, n, r);
		switch (this._view) {
			case "timeline": return jr(e, i, Wn(this._alerts, n, t.installation_alerts, t.settings, r), r, this._window.kind === "relative", this.onTip);
			case "totals": return Mr(e, i);
		}
	}
	static {
		this.styles = [
			V,
			Nr,
			_r,
			o`
      .card-content {
        position: relative;
        padding: 0 16px 8px;
      }
      ha-card:not([header]) .card-content {
        padding-top: 8px;
      }
      irrigation-window-picker {
        margin: 8px 0;
      }
      .view {
        border-top: 1px solid var(--divider-color);
        padding-top: 8px;
      }
    `
		];
	}
}), Dt({
	type: $,
	name: "Irrigation Scheduler History",
	description: A(void 0, "history_description"),
	preview: !0
});
//#endregion
//#region src/card/history-editor.ts
var zr = class extends O {
	static {
		this.properties = {
			hass: { attribute: !1 },
			_config: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new P(this), this.hass = void 0, this._config = void 0;
	}
	connectedCallback() {
		super.connectedCallback(), Et().then(() => this.requestUpdate());
	}
	setConfig(e) {
		this._config = {
			...e,
			zones: Array.isArray(e.zones) ? [...e.zones] : []
		};
	}
	changeConfig(e) {
		this._config &&= Fn(this, this._config, e);
	}
	render() {
		let e = this.hass, t = this._config;
		return !e || !t ? w : S`
      ${Ln(e, this.store.state.snapshot?.zones ?? [], t.zones, (e) => this.changeConfig({ zones: e }))}
      <div class="section">
        <div class="label">${A(e, "history_card_view")}</div>
        ${Cr(e, Sr(t.view), (e) => this.changeConfig({ view: e }))}
      </div>
      <div class="section">
        <div class="label">${A(e, "history_card_window")}</div>
        <irrigation-window-picker
          allow-custom
          .hass=${e}
          .window=${Xn(t.window)}
          @window-changed=${(e) => {
			let t = e.detail.window;
			t.kind === "relative" && this.changeConfig({ window: {
				amount: t.amount,
				unit: t.unit
			} });
		}}
        ></irrigation-window-picker>
      </div>
      ${Rn(e, t.title, (e) => this.changeConfig({ title: e }))}
      <div class="muted small help">${A(e, "history_card_help")}</div>
    `;
	}
	static {
		this.styles = [
			V,
			zn,
			o`
      :host {
        display: block;
      }
      .help {
        margin-top: 8px;
      }
    `
		];
	}
};
z(`${$}-editor`, zr);
//#endregion
