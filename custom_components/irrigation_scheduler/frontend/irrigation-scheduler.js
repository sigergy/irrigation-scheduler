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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, ee = h.trustedTypes, te = ee ? ee.emptyScript : "", ne = h.reactiveElementPolyfillSupport, g = (e, t) => e, _ = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? te : null;
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
}, re = (e, t) => !l(e, t), ie = {
	attribute: !0,
	type: String,
	converter: _,
	reflect: !1,
	useDefault: !1,
	hasChanged: re
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var v = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = ie) {
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
		return this.elementProperties.get(e) ?? ie;
	}
	static _$Ei() {
		if (this.hasOwnProperty(g("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(g("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(g("properties"))) {
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
			let i = (n.converter?.toAttribute === void 0 ? _ : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? _ : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? re)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
v.elementStyles = [], v.shadowRootOptions = { mode: "open" }, v[g("elementProperties")] = /* @__PURE__ */ new Map(), v[g("finalized")] = /* @__PURE__ */ new Map(), ne?.({ ReactiveElement: v }), (h.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var y = globalThis, ae = (e) => e, b = y.trustedTypes, oe = b ? b.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, x = "$lit$", S = `lit$${Math.random().toFixed(9).slice(2)}$`, C = "?" + S, se = `<${C}>`, w = document, T = () => w.createComment(""), E = (e) => e === null || typeof e != "object" && typeof e != "function", D = Array.isArray, ce = (e) => D(e) || typeof e?.[Symbol.iterator] == "function", O = "[ 	\n\f\r]", k = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, le = /-->/g, ue = />/g, A = RegExp(`>|${O}(?:([^\\s"'>=/]+)(${O}*=${O}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), de = /'/g, fe = /"/g, pe = /^(?:script|style|textarea|title)$/i, j = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), M = Symbol.for("lit-noChange"), N = Symbol.for("lit-nothing"), me = /* @__PURE__ */ new WeakMap(), P = w.createTreeWalker(w, 129);
function he(e, t) {
	if (!D(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return oe === void 0 ? t : oe.createHTML(t);
}
var ge = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = k;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === k ? c[1] === "!--" ? o = le : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = A) : (pe.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = A) : o = ue : o === A ? c[0] === ">" ? (o = i ?? k, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? A : c[3] === "\"" ? fe : de) : o === fe || o === de ? o = A : o === le || o === ue ? o = k : (o = A, i = void 0);
		let d = o === A && e[t + 1].startsWith("/>") ? " " : "";
		a += o === k ? n + se : l >= 0 ? (r.push(s), n.slice(0, l) + x + n.slice(l) + S + d) : n + S + (l === -2 ? t : d);
	}
	return [he(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, F = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = ge(t, n);
		if (this.el = e.createElement(l, r), P.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = P.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(x)) {
					let t = u[o++], n = i.getAttribute(e).split(S), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? ve : r[1] === "?" ? ye : r[1] === "@" ? be : R
					}), i.removeAttribute(e);
				} else e.startsWith(S) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (pe.test(i.tagName)) {
					let e = i.textContent.split(S), t = e.length - 1;
					if (t > 0) {
						i.textContent = b ? b.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], T()), P.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], T());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === C) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(S, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += S.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = w.createElement("template");
		return n.innerHTML = e, n;
	}
};
function I(e, t, n = e, r) {
	if (t === M) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = E(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = I(e, i._$AS(e, t.values), i, r)), t;
}
var _e = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? w).importNode(t, !0);
		P.currentNode = r;
		let i = P.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new L(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new xe(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = P.nextNode(), a++);
		}
		return P.currentNode = w, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, L = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = N, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = I(this, e, t), E(e) ? e === N || e == null || e === "" ? (this._$AH !== N && this._$AR(), this._$AH = N) : e !== this._$AH && e !== M && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ce(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== N && E(this._$AH) ? this._$AA.nextSibling.data = e : this.T(w.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = F.createElement(he(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new _e(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = me.get(e.strings);
		return t === void 0 && me.set(e.strings, t = new F(e)), t;
	}
	k(t) {
		D(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(T()), this.O(T()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ae(e).nextSibling;
			ae(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, R = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = N, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = N;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = I(this, e, t, 0), a = !E(e) || e !== this._$AH && e !== M, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = I(this, r[n + o], t, o), s === M && (s = this._$AH[o]), a ||= !E(s) || s !== this._$AH[o], s === N ? e = N : e !== N && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === N ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, ve = class extends R {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === N ? void 0 : e;
	}
}, ye = class extends R {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== N);
	}
}, be = class extends R {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = I(this, e, t, 0) ?? N) === M) return;
		let n = this._$AH, r = e === N && n !== N || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== N && (n === N || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, xe = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		I(this, e);
	}
}, Se = {
	M: x,
	P: S,
	A: C,
	C: 1,
	L: ge,
	R: _e,
	D: ce,
	V: I,
	I: L,
	H: R,
	N: ye,
	U: be,
	B: ve,
	F: xe
}, Ce = y.litHtmlPolyfillSupport;
Ce?.(F, L), (y.litHtmlVersions ??= []).push("3.3.3");
var we = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new L(t.insertBefore(T(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Te = globalThis, z = class extends v {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = we(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return M;
	}
};
z._$litElement$ = !0, z.finalized = !0, Te.litElementHydrateSupport?.({ LitElement: z });
var Ee = Te.litElementPolyfillSupport;
Ee?.({ LitElement: z }), (Te.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var B = "irrigation_scheduler", De = `${B}/subscribe`;
function Oe(e, t) {
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
		type: `${B}/save_zone`,
		zone: n
	});
}
var ke = (e, t) => e.callWS({
	type: `${B}/delete_zone`,
	zone_id: t
});
function Ae(e, t) {
	let n = {
		global_max_valves: t.global_max_valves,
		notify_targets: t.notify_targets,
		rain_sensor: t.rain_sensor,
		rain_past_hours: t.rain_past_hours,
		rain_past_threshold_mm: t.rain_past_threshold_mm,
		weather_entity: t.weather_entity,
		rain_forecast_hours: t.rain_forecast_hours,
		rain_forecast_threshold_mm: t.rain_forecast_threshold_mm
	};
	return e.callWS({
		type: `${B}/save_settings`,
		settings: n
	});
}
var je = (e, t) => e.callWS({
	type: `${B}/run_zone`,
	zone_id: t
}), Me = (e, t) => e.callWS({
	type: `${B}/run_valve`,
	entity_id: t
}), Ne = (e, t) => e.callWS({
	type: `${B}/stop`,
	...t ? { zone_id: t } : {}
}), Pe = (e, t) => e.callWS({
	type: `${B}/pause_valve`,
	entity_id: t
}), Fe = (e, t, n) => e.callWS({
	type: `${B}/set_valve_enabled`,
	entity_id: t,
	enabled: n
}), Ie = (e, t, n) => e.callWS({
	type: `${B}/set_zone_enabled`,
	zone_id: t,
	enabled: n
}), Le = {
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
	minutes_short: "{n} min",
	add_zone: "＋ Zona",
	empty_list: "Aún no hay zonas.",
	zone_not_found: "Zona no encontrada",
	new_zone: "Zona nueva",
	back: "Volver",
	save: "Guardar",
	delete_zone: "🗑 Borrar zona",
	confirm_leave: "Hay cambios sin guardar. ¿Salir sin guardar?",
	confirm_delete: "¿Borrar la zona «{name}»? Se apagan sus válvulas abiertas.",
	confirm_discard_settings: "Hay cambios sin guardar en Ajustes. ¿Descartarlos?",
	saved: "Zona guardada",
	not_saved: "No se ha guardado: revisa los campos marcados.",
	external_change: "Esta zona ha cambiado fuera del editor.",
	reload: "Recargar",
	zone_deleted: "La zona se ha borrado.",
	read_only: "Solo lectura: editar requiere ser administrador.",
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
	valve_switch: "Switch",
	valve_minutes: "Min",
	manual_only: "Solo manual",
	add_times_first: "Añade horas a la zona",
	remove_valve: "Quitar",
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
	rule_hours_48: "Entre 1 y 48",
	rule_positive: "Debe ser mayor que 0",
	rule_unknown: "Valor no válido",
	concurrency: "Simultaneidad",
	limit_global: "Limitar válvulas abiertas en toda la instalación",
	global_max: "Máximo global",
	global_off_help: "Desactivado = sin límite global.",
	notifications: "Notificaciones",
	notifications_help: "Avisos de fallos de válvula. Solo servicios notify.mobile_app_*.",
	add_target: "＋ Destino",
	no_targets: "No hay dispositivos móviles con la app de HA.",
	rain_help: "Solo en las zonas con «Omitir por lluvia». Un bloque no riega si se cumple cualquiera de las dos condiciones. La orden manual siempre riega.",
	rain_past: "Lluvia ya caída",
	rain_sensor: "Pluviómetro: sensor de lluvia acumulada en mm (opcional)",
	rain_past_hours: "Mirar las últimas… (horas, 1–24)",
	rain_past_threshold: "No regar si han caído al menos… (mm)",
	rain_past_rule: "No riega si han caído {mm} mm o más en las últimas {hours} horas.",
	rain_forecast: "Lluvia prevista",
	weather_entity: "Previsión: entidad weather (opcional)",
	rain_forecast_hours: "Mirar las próximas… (horas, 1–48)",
	rain_forecast_threshold: "No regar si se prevén al menos… (mm)",
	rain_forecast_rule: "No riega si se prevén {mm} mm o más en las próximas {hours} horas.",
	settings_saved: "Ajustes guardados",
	settings_not_saved: "No se han guardado los ajustes: revisa los campos marcados.",
	card_description: "Estado y control de las zonas de riego.",
	card_no_zones: "Elige al menos una zona en el editor de la tarjeta.",
	card_zones: "Zonas",
	card_order_help: "El orden de los chips es el orden en la tarjeta.",
	card_title: "Título (opcional)"
}, Re = {
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
	minutes_short: "{n} min",
	add_zone: "＋ Zone",
	empty_list: "No zones yet.",
	zone_not_found: "Zone not found",
	new_zone: "New zone",
	back: "Back",
	save: "Save",
	delete_zone: "🗑 Delete zone",
	confirm_leave: "There are unsaved changes. Leave without saving?",
	confirm_delete: "Delete zone «{name}»? Its open valves are turned off.",
	confirm_discard_settings: "There are unsaved changes in Settings. Discard them?",
	saved: "Zone saved",
	not_saved: "Not saved: check the highlighted fields.",
	external_change: "This zone changed outside the editor.",
	reload: "Reload",
	zone_deleted: "The zone was deleted.",
	read_only: "Read only: editing requires an administrator.",
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
	valve_switch: "Switch",
	valve_minutes: "Min",
	manual_only: "Manual only",
	add_times_first: "Add times to the zone",
	remove_valve: "Remove",
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
	rule_hours_48: "Between 1 and 48",
	rule_positive: "Must be greater than 0",
	rule_unknown: "Invalid value",
	concurrency: "Concurrency",
	limit_global: "Limit open valves across the whole installation",
	global_max: "Global maximum",
	global_off_help: "Off = no global limit.",
	notifications: "Notifications",
	notifications_help: "Valve failure alerts. Only notify.mobile_app_* services.",
	add_target: "＋ Target",
	no_targets: "No mobile devices with the HA app.",
	rain_help: "Only for zones with «Skip on rain». A block does not water if either condition is met. A manual command always waters.",
	rain_past: "Rain already fallen",
	rain_sensor: "Rain gauge: accumulated rain sensor in mm (optional)",
	rain_past_hours: "Look back over the last… (hours, 1–24)",
	rain_past_threshold: "Don't water if at least this fell… (mm)",
	rain_past_rule: "Does not water if {mm} mm or more fell in the last {hours} hours.",
	rain_forecast: "Forecast rain",
	weather_entity: "Forecast: weather entity (optional)",
	rain_forecast_hours: "Look ahead over the next… (hours, 1–48)",
	rain_forecast_threshold: "Don't water if at least this is forecast… (mm)",
	rain_forecast_rule: "Does not water if {mm} mm or more is forecast in the next {hours} hours.",
	settings_saved: "Settings saved",
	settings_not_saved: "Settings not saved: check the highlighted fields.",
	card_description: "Status and control of irrigation zones.",
	card_no_zones: "Pick at least one zone in the card editor.",
	card_zones: "Zones",
	card_order_help: "Chip order is the order in the card.",
	card_title: "Title (optional)"
};
function V(e) {
	return (e?.locale?.language ?? e?.language ?? document.documentElement.lang)?.startsWith("es") ? "es" : "en";
}
function H(e, t, n = {}) {
	return (V(e) === "es" ? Le[t] : Re[t]).replace(/\{(\w+)\}/g, (e, t) => t in n ? String(n[t]) : e);
}
function ze(e) {
	return V(e) === "es" ? [
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
function U(e, t) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: t,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(e);
}
function Be(e, t) {
	if (!t) return "—";
	let n = e.config.time_zone, r = V(e), i = new Date(t), a = new Intl.DateTimeFormat(r, {
		timeZone: n,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).format(i), o = /* @__PURE__ */ new Date();
	return U(i, n) === U(o, n) ? H(e, "today", { time: a }) : U(i, n) === U(new Date(o.getTime() + 864e5), n) ? H(e, "tomorrow", { time: a }) : `${new Intl.DateTimeFormat(r, {
		timeZone: n,
		weekday: "short"
	}).format(i)} ${a}`;
}
function Ve(e) {
	let t = Math.max(0, Math.round(e)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${n}:${String(r).padStart(2, "0")}:${i}` : `${r}:${i}`;
}
function He(e, t) {
	if (t.rule === "V10" || t.rule === "V11") return String(t.path[t.path.length - 1]).endsWith("_hours") ? H(e, t.rule === "V10" ? "rule_hours_24" : "rule_hours_48") : H(e, "rule_positive");
	let n = `rule_${t.rule}`;
	return n in Le ? H(e, n) : H(e, "rule_unknown");
}
function Ue(e, t) {
	let n = {};
	for (let r of t) n[r.path.join(".")] ??= He(e, r);
	return n;
}
//#endregion
//#region src/store.ts
var We = 3e4, Ge = /* @__PURE__ */ new WeakMap();
function Ke(e, t) {
	e.state = t;
	for (let n of e.listeners) n(t);
}
function qe(e, t) {
	let n = e.subscribeMessage((e) => Ke(t, { snapshot: e }), { type: De });
	t.unsubscribe = n, n.catch((r) => {
		if (t.unsubscribe !== n) return;
		t.unsubscribe = void 0;
		let i = r?.code;
		Ke(t, { error: i === "not_loaded" ? "not_loaded" : "unknown" }), t.retry = window.setTimeout(() => {
			t.retry = void 0, t.listeners.size && qe(e, t);
		}, We);
	});
}
function Je(e, t) {
	let n = Ge.get(e);
	n || (n = {
		state: {},
		listeners: /* @__PURE__ */ new Set()
	}, Ge.set(e, n));
	let r = n;
	return r.listeners.add(t), (r.state.snapshot || r.state.error) && t(r.state), !r.unsubscribe && r.retry === void 0 && qe(e, r), () => {
		if (r.listeners.delete(t), r.listeners.size) return;
		window.clearTimeout(r.retry), r.retry = void 0;
		let e = r.unsubscribe;
		r.unsubscribe = void 0, r.state = {}, e?.then((e) => e()).catch(() => void 0);
	};
}
var Ye = class {
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
		e !== this.connection && (this.release?.(), this.connection = e, this.state = {}, this.release = e ? Je(e, (e) => {
			this.state = e, this.host.requestUpdate();
		}) : void 0);
	}
}, Xe = class {
	constructor(e) {
		this.host = e, e.addController(this);
	}
	hostConnected() {
		this.timer = window.setInterval(() => this.host.requestUpdate(), 1e3);
	}
	hostDisconnected() {
		window.clearInterval(this.timer), this.timer = void 0;
	}
}, Ze = {
	run: "▶",
	resume: "▶",
	pause: "⏸",
	stop: "■"
}, Qe = {
	run: "action_run",
	resume: "action_resume",
	pause: "action_pause",
	stop: "action_stop"
};
function W(e, t, n) {
	e.dispatchEvent(new CustomEvent(t, {
		detail: n,
		bubbles: !0,
		composed: !0
	}));
}
function G(e, t) {
	let n = e.isConnected ? e : document.querySelector("home-assistant");
	n && W(n, "hass-notification", { message: t });
}
function K(e, t) {
	let n = t?.message;
	return typeof n == "string" && n ? n : H(e, "command_failed");
}
async function $e(e, t, n) {
	try {
		await n(t);
	} catch (n) {
		G(e, K(t, n));
	}
}
function q(e, t, n, r) {
	let i = H(t, Qe[n.action]);
	return j`<button
    class="control ${n.action === "stop" ? "danger" : ""}"
    title=${i}
    aria-label=${r ?? i}
    ?disabled=${!t.connected}
    @click=${(r) => {
		r.stopPropagation(), $e(e, t, n.run);
	}}
  >
    ${Ze[n.action]}${r ? ` ${r}` : ""}
  </button>`;
}
//#endregion
//#region src/shared/ha-components.ts
function J(e, t) {
	customElements.get(e) || customElements.define(e, t);
}
function Y(e) {
	return e.detail?.value;
}
var et = 1e4, tt;
async function nt() {
	if (customElements.get("ha-selector")) return;
	await customElements.whenDefined("partial-panel-resolver");
	let e = document.createElement("partial-panel-resolver");
	e.hass = { panels: [{
		url_path: "tmp",
		component_name: "config"
	}] }, e._updateRoutes?.(), await e.routerOptions.routes.tmp.load(), await customElements.whenDefined("ha-panel-config"), await document.createElement("ha-panel-config").routerOptions.routes.automation.load(), await customElements.whenDefined("ha-selector");
}
function rt() {
	return tt ??= Promise.race([nt().catch((e) => console.warn("Irrigation Scheduler: ha-selector", e)), new Promise((e) => window.setTimeout(e, et))]), tt;
}
//#endregion
//#region src/shared/styles.ts
var X = o`
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
`, it = o`
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
  .toolbar .title {
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
`, at = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, ot = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), st = class {
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
}, ct = "important", lt = " !" + ct, ut = ot(class extends st {
	constructor(e) {
		if (super(e), e.type !== at.ATTRIBUTE || e.name !== "style" || e.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
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
				let t = typeof r == "string" && r.endsWith(lt);
				e.includes("-") || t ? n.setProperty(e, t ? r.slice(0, -11) : r, t ? ct : "") : n[e] = r;
			}
		}
		return M;
	}
}), dt = {
	running: "💧",
	manual: "💧",
	queued: "⏳",
	idle: "○",
	stopped: "⊘"
}, ft = {
	running: "status_running",
	manual: "status_manual",
	queued: "status_queued",
	idle: "status_idle",
	stopped: "status_stopped"
};
function pt(e, t) {
	let n = t.open_valves.find((t) => t.entity_id === e.entity_id);
	return n ? {
		state: "running",
		open: n
	} : t.manual_on.some((t) => t.entity_id === e.entity_id) ? { state: "manual" } : t.pending.some((t) => t.entity_id === e.entity_id) ? { state: "queued" } : { state: e.enabled ? "idle" : "stopped" };
}
function mt(e) {
	return (Date.parse(e.ends_at) - Date.now()) / 1e3;
}
function ht(e) {
	let t = Date.parse(e.started_at), n = Date.parse(e.ends_at) - t;
	return j`<div class="progress"><div style=${ut({ width: `${(n > 0 ? Math.min(1, Math.max(0, (Date.now() - t) / n)) : 1) * 100}%` })}></div></div>`;
}
function gt(e, t) {
	return t.open ? H(e, "remaining", { time: Ve(mt(t.open)) }) : H(e, ft[t.state]);
}
function _t(e, t) {
	let n = e.entity_id, r = {
		action: "stop",
		run: (e) => Fe(e, n, !1)
	};
	switch (t.state) {
		case "running":
		case "manual":
		case "queued": return [{
			action: "pause",
			run: (e) => Pe(e, n)
		}, r];
		case "idle": return [{
			action: "run",
			run: (e) => Me(e, n)
		}, r];
		case "stopped": return [{
			action: "resume",
			run: (e) => Fe(e, n, !0)
		}];
	}
}
//#endregion
//#region src/shared/zone-status.ts
var vt = {
	running: "status_running",
	queued: "status_queued",
	idle: "status_idle",
	stopped: "status_stopped"
}, yt = {
	run: "zone_run",
	resume: "zone_resume",
	pause: "zone_pause",
	stop: "zone_stop"
};
function bt(e, t) {
	return e.enabled ? e.status === "idle" && t.manual_on.some((t) => t.zone_id === e.zone_id) ? "running" : e.status : "stopped";
}
function xt(e, t) {
	return j`<span class="badge ${t}">${H(e, vt[t])}</span>`;
}
function St(e, t) {
	let n = ze(e);
	return `${t.days.length === 7 ? H(e, "every_day") : t.days.map((e) => n[e]).join(" ")} · ${t.start_times.length ? t.start_times.join(", ") : H(e, "no_times")} · ${t.valves.length === 1 ? H(e, "valves_one") : H(e, "valves_count", { n: t.valves.length })}`;
}
function Ct(e, t) {
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
function wt(e, t) {
	let n = e.zone_id, r = {
		action: "stop",
		run: (e) => Ie(e, n, !1)
	};
	switch (t) {
		case "running":
		case "queued": return [{
			action: "pause",
			run: (e) => Ne(e, n)
		}, r];
		case "idle": return [{
			action: "run",
			run: (e) => je(e, n)
		}, r];
		case "stopped": return [{
			action: "resume",
			run: (e) => Ie(e, n, !0)
		}];
	}
}
J("irrigation-zone-list", class extends z {
	static {
		this.properties = {
			hass: { attribute: !1 },
			snapshot: { attribute: !1 }
		};
	}
	constructor() {
		super(), new Xe(this);
	}
	render() {
		if (!this.hass || !this.snapshot) return N;
		let e = this.hass.user?.is_admin ?? !1, t = this.snapshot.zones;
		return j`
      <ha-card>
        ${t.length ? t.map((e) => this.renderRow(e)) : j`<div class="empty muted">${H(this.hass, "empty_list")}</div>`}
      </ha-card>
      ${e ? j`<button class="fab filled" @click=${() => this.open(null)}>${H(this.hass, "add_zone")}</button>` : N}
    `;
	}
	renderRow(e) {
		let t = this.hass, n = bt(e, this.snapshot), r = n === "running" ? Ct(e, this.snapshot) : void 0;
		return j`
      <div class="list-row ${n === "stopped" ? "stopped" : ""}" @click=${() => this.open(e.zone_id)}>
        <div class="main">
          <div class="name">${e.name}</div>
          <div class="muted small">${St(t, e)}</div>
        </div>
        <div class="status">
          ${xt(t, n)}
          ${r ? j`<div class="small">
                ${r.valve.name}${r.open ? ` · ${Ve(mt(r.open))}` : ""}
              </div>` : N}
        </div>
        <div class="next small muted">${Be(t, e.next_run)}</div>
        <div class="buttons">${wt(e, n).map((e) => q(this, t, e))}</div>
        <span class="chevron muted">›</span>
      </div>
    `;
	}
	open(e) {
		W(this, "zone-open", { zoneId: e });
	}
	static {
		this.styles = [X, o`
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
      .empty {
        padding: 24px 16px;
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
    `];
	}
});
//#endregion
//#region node_modules/lit-html/directive-helpers.js
var { I: Tt } = Se, Et = (e) => e, Dt = () => document.createComment(""), Z = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new Tt(r.insertBefore(Dt(), i), r.insertBefore(Dt(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = Et(e).nextSibling;
				Et(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, Q = (e, t, n = e) => (e._$AI(t, n), e), Ot = {}, kt = (e, t = Ot) => e._$AH = t, At = (e) => e._$AH, jt = (e) => {
	e._$AR(), e._$AA.remove();
}, Mt = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, Nt = ot(class extends st {
	constructor(e) {
		if (super(e), e.type !== at.CHILD) throw Error("repeat() can only be used in text expressions");
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
		let i = At(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = Q(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = Q(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = Q(i[d], a[m]), Z(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = Q(i[f], a[p]), Z(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = Mt(o, p, m), u = Mt(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = Z(e, i[d]);
					Q(t, a[p]), c[p] = t;
				} else c[p] = Q(n, a[p]), Z(e, i[d], n), i[t] = null;
				p++;
			} else jt(i[f]), f--;
		} else jt(i[d]), d++;
		for (; p <= m;) {
			let t = Z(e, c[m + 1]);
			Q(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && jt(e);
		}
		return this.ut = o, kt(e, c), M;
	}
}), Pt = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], Ft = 0;
function It(e) {
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
			key: Ft++
		}))
	};
}
function Lt() {
	return {
		zone_id: null,
		name: "",
		enabled: !0,
		mode: "manual",
		days: [...Pt],
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
function $(e) {
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
J("irrigation-zone-editor", class extends z {
	static {
		this.properties = {
			hass: { attribute: !1 },
			narrow: { type: Boolean },
			snapshot: { attribute: !1 },
			zoneId: { attribute: !1 },
			_draft: { state: !0 },
			_errors: { state: !0 },
			_banner: { state: !0 },
			_external: { state: !0 },
			_saving: { state: !0 },
			_newTime: { state: !0 },
			_dragKey: { state: !0 }
		};
	}
	constructor() {
		super(), this.loaded = !1, this.loadedId = null, this.baseline = "", this.seen = !1, this.deleting = !1, this.narrow = !1, this._draft = void 0, this._errors = {}, this._banner = void 0, this._external = !1, this._saving = !1, this._newTime = "", this._dragKey = void 0, new Xe(this);
	}
	get dirty() {
		return this._draft !== void 0 && $(this._draft) !== this.baseline;
	}
	liveZone() {
		return this.loadedId === null ? void 0 : this.snapshot.zones.find((e) => e.zone_id === this.loadedId);
	}
	willUpdate(e) {
		this.hass && this.snapshot && (!this.loaded || e.has("zoneId") && this.zoneId !== this.loadedId ? this.load() : e.has("snapshot") && this.checkExternal());
	}
	load() {
		if (this.loaded = !0, this.loadedId = this.zoneId, this.deleting = !1, this._errors = {}, this._banner = void 0, this._external = !1, this.zoneId === null) {
			this._draft = Lt(), this.baseline = $(this._draft), this.seen = !1;
			return;
		}
		let e = this.liveZone();
		if (!e) {
			this._draft = void 0, this.leaveDeleted();
			return;
		}
		this.seen = !0, this._draft = It(e), this.baseline = $(e);
	}
	checkExternal() {
		if (this._saving) return;
		let e = this.liveZone();
		if (!e) {
			this.seen && !this.deleting && this.leaveDeleted();
			return;
		}
		this.seen = !0;
		let t = $(e);
		t !== this.baseline && (this._draft && t === $(this._draft) ? this.baseline = t : this._external = !0);
	}
	leaveDeleted() {
		this.updateComplete.then(() => {
			G(this, H(this.hass, "zone_deleted")), W(this, "zone-close");
		});
	}
	reloadFromLive() {
		let e = this.liveZone();
		e && (this._draft = It(e), this.baseline = $(e), this._external = !1, this._errors = {}, this._banner = void 0);
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
			key: Ft++
		}], !0);
	}
	removeValve(e) {
		this._draft && this.setValves(this._draft.valves.filter((t) => t.key !== e), !0);
	}
	drop(e) {
		let t = this._draft, n = this._dragKey;
		if (this._dragKey = void 0, !t || n === void 0 || n === e) return;
		let r = [...t.valves], i = r.findIndex((e) => e.key === n), a = r.findIndex((t) => t.key === e);
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
	back() {
		(!this.dirty || window.confirm(H(this.hass, "confirm_leave"))) && W(this, "zone-close");
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
			let e = await Oe(this.hass, n);
			if (e.errors.length || !e.zone) {
				this._errors = Ue(this.hass, e.errors), this._banner = H(this.hass, "not_saved");
				return;
			}
			let t = e.zone;
			t.zone_id !== this.loadedId && (this.seen = !1), this.loadedId = t.zone_id, this._draft = It(t), this.baseline = $(t), this._errors = {}, this._banner = void 0, this._external = !1, G(this, H(this.hass, "saved")), W(this, "zone-saved", { zoneId: t.zone_id });
		} catch (e) {
			G(this, K(this.hass, e));
		} finally {
			this._saving = !1;
		}
	}
	async removeZone() {
		let e = this.loadedId, t = this._draft;
		if (e === null || !t) return;
		let n = this.liveZone()?.name ?? t.name;
		if (window.confirm(H(this.hass, "confirm_delete", { name: n }))) {
			this.deleting = !0;
			try {
				await ke(this.hass, e), W(this, "zone-close");
			} catch (e) {
				this.deleting = !1, G(this, K(this.hass, e));
			}
		}
	}
	error(e) {
		let t = this._errors[e];
		return t ? j`<div class="error-text">${t}</div>` : N;
	}
	render() {
		let e = this._draft;
		if (!this.hass || !this.snapshot || !e) return N;
		let t = this.hass, n = t.user?.is_admin ?? !1, r = this.liveZone(), i = r ? bt(r, this.snapshot) : void 0;
		return j`
      <div class="toolbar">
        <button class="icon" title=${H(t, "back")} @click=${this.back}>←</button>
        <span class="title">${e.name || H(t, "new_zone")}</span>
        ${r && i ? j`${xt(t, i)}
            ${wt(r, i).map((e) => q(this, t, e, H(t, yt[e.action])))}` : N}
        ${n && r ? j`<button class="danger" ?disabled=${this._saving || !t.connected} @click=${this.removeZone}>
              ${H(t, "delete_zone")}
            </button>` : N}
        <span class="spacer"></span>
        ${n ? j`<button class="filled" ?disabled=${this._saving || !t.connected} @click=${this.save}>
              ${H(t, "save")}
            </button>` : N}
      </div>
      <div class="content">
        ${t.connected ? N : j`<div class="banner error">${H(t, "disconnected")}</div>`}
        ${n ? N : j`<div class="banner info">${H(t, "read_only")}</div>`}
        ${this._external ? j`<div class="banner warning">
              ${H(t, "external_change")}<span class="spacer"></span>
              <button @click=${this.reloadFromLive}>${H(t, "reload")}</button>
            </div>` : N}
        ${this._banner ? j`<div class="banner error">${this._banner}</div>` : N}
        <div class="columns">
          ${this.renderSchedule(e, r, !n)} ${this.renderValves(e, r, !n)}
        </div>
      </div>
    `;
	}
	renderSchedule(e, t, n) {
		let r = this.hass, i = ze(r), a = Object.entries(this._errors).filter(([e]) => e.startsWith("start_times."));
		return j`<div class="card">
      <div class="section">
        <ha-selector
          .hass=${r}
          .selector=${{ text: {} }}
          .label=${`${H(r, "field_name")}*`}
          .value=${e.name}
          .required=${!0}
          .disabled=${n}
          @value-changed=${(e) => this.patch({ name: Y(e) ?? "" })}
        ></ha-selector>
        ${this.error("name")}
      </div>
      <div class="section">
        <div class="label">${H(r, "rain")}</div>
        <ha-selector
          .hass=${r}
          .selector=${{ boolean: {} }}
          .label=${H(r, "rain_skip")}
          .value=${e.rain_skip}
          .disabled=${n}
          @value-changed=${(e) => this.patch({ rain_skip: Y(e) ?? !1 })}
        ></ha-selector>
        <div class="muted small">${H(r, "rain_skip_help")}</div>
      </div>
      <div class="section">
        <div class="label">${H(r, "mode")}</div>
        <div class="chips">
          <button
            class="chip ${e.mode === "manual" ? "on" : ""}"
            ?disabled=${n}
            @click=${() => this.patch({ mode: "manual" })}
          >
            ${H(r, "mode_manual")}
          </button>
          <button class="chip ${e.mode === "auto" ? "on" : ""}" disabled>${H(r, "mode_auto")}</button>
        </div>
        <div class="muted small">${H(r, "auto_help")}</div>
        ${this.error("mode")}
      </div>
      <div class="section">
        <div class="label">${H(r, "days")}</div>
        <div class="chips">
          ${Pt.map((t) => j`<button
                class="chip ${e.days.includes(t) ? "on" : ""}"
                ?disabled=${n}
                @click=${() => this.toggleDay(t)}
              >
                ${i[t]}
              </button>`)}
        </div>
        ${this.error("days")}
      </div>
      <div class="section">
        <div class="label">${H(r, "start_times")}</div>
        <div class="chips">
          ${e.start_times.map((e) => j`<button class="chip on" ?disabled=${n} @click=${() => this.removeTime(e)}>
                ${e}${n ? "" : " ✕"}
              </button>`)}
        </div>
        ${n ? N : j`<div class="row add-time">
              <ha-selector
                .hass=${r}
                .selector=${{ time: { no_second: !0 } }}
                .value=${this._newTime}
                @value-changed=${(e) => {
			this._newTime = Y(e) ?? "";
		}}
              ></ha-selector>
              <button ?disabled=${!this._newTime} @click=${this.addTime}>${H(r, "add_time")}</button>
            </div>`}
        ${this.error("start_times")}
        ${a.map(([t, n]) => {
			let r = Number(t.split(".")[1]);
			return j`<div class="error-text">${e.start_times[r] ?? ""} ${n}</div>`;
		})}
      </div>
      <div class="section">
        <ha-selector
          .hass=${r}
          .selector=${{ number: {
			min: 1,
			max: 20,
			mode: "box"
		} }}
          .label=${H(r, "max_simultaneous")}
          .value=${e.max_simultaneous}
          .disabled=${n}
          @value-changed=${(e) => this.patch({ max_simultaneous: Math.trunc(Y(e) ?? 0) })}
        ></ha-selector>
        ${this.error("max_simultaneous")}
      </div>
      <div class="muted small">
        ${H(r, "next_run", { when: t ? Be(r, t.next_run) : "—" })}
      </div>
    </div>`;
	}
	renderValves(e, t, n) {
		let r = this.hass;
		return j`<div class="card">
      <div class="row">
        <h3>${H(r, "valves")}</h3>
        <span class="muted small">${H(r, "queue_order")}</span>
        <span class="spacer"></span>
        ${n ? N : j`<button @click=${this.addValve}>${H(r, "add_valve")}</button>`}
      </div>
      <div class="table">
        <div class="valve head muted small">
          <span></span><span>${H(r, "col_name")}</span><span>${H(r, "col_entity")}</span>
          <span>${H(r, "col_minutes")}</span><span>${H(r, "col_blocks")}</span>
          <span>${H(r, "col_status")}</span><span></span><span></span>
        </div>
        ${e.valves.length ? Nt(e.valves, (e) => e.key, (r, i) => this.renderValve(e, t, r, i, n)) : j`<div class="muted small empty">${H(r, "no_valves")}</div>`}
      </div>
      ${n ? N : j`<div class="muted small note">${H(r, "picker_help")}</div>`}
      ${t ? N : j`<div class="muted small note">${H(r, "status_after_save")}</div>`}
    </div>`;
	}
	renderValve(e, t, n, r, i) {
		let a = this.hass, o = `valves.${r}`, s = n.entity_id ? t?.valves.find((e) => e.entity_id === n.entity_id) : void 0, c = s ? pt(s, this.snapshot) : void 0;
		return j`<div
      class="valve ${this._dragKey === n.key ? "dragging" : ""}"
      @dragover=${(e) => {
			this._dragKey !== void 0 && e.preventDefault();
		}}
      @drop=${(e) => {
			e.preventDefault(), this.drop(n.key);
		}}
    >
      <span
        class="handle muted"
        title=${H(a, "drag")}
        draggable=${i ? "false" : "true"}
        @dragstart=${(e) => {
			this._dragKey = n.key, e.dataTransfer?.setData("text/plain", String(n.key));
		}}
        @dragend=${() => {
			this._dragKey = void 0;
		}}
        >⋮⋮</span
      >
      <div>
        <ha-selector
          .hass=${a}
          .selector=${{ text: {} }}
          .label=${`${H(a, "valve_name")}*`}
          .value=${n.name}
          .required=${!0}
          .disabled=${i}
          @value-changed=${(e) => this.patchValve(n.key, { name: Y(e) ?? "" })}
        ></ha-selector>
        ${this.error(`${o}.name`)}
      </div>
      <div>
        <ha-selector
          .hass=${a}
          .selector=${{ entity: {
			domain: "switch",
			exclude_entities: this.excluded(n.key)
		} }}
          .label=${H(a, "valve_switch")}
          .value=${n.entity_id || void 0}
          .disabled=${i}
          @value-changed=${(e) => this.entityChanged(n.key, Y(e) ?? "")}
        ></ha-selector>
        ${this.error(`${o}.entity_id`)}
      </div>
      <div>
        <ha-selector
          .hass=${a}
          .selector=${{ number: {
			min: 1,
			max: 600,
			mode: "box"
		} }}
          .label=${H(a, "valve_minutes")}
          .value=${n.duration_min}
          .disabled=${i}
          @value-changed=${(e) => this.patchValve(n.key, { duration_min: Math.trunc(Y(e) ?? 0) })}
        ></ha-selector>
        ${this.error(`${o}.duration_min`)}
      </div>
      <div>${this.renderBlocks(e, n, i)} ${this.error(`${o}.start_times`)}</div>
      <div class="small">${c ? this.renderValveStatus(c) : j`<span class="muted">—</span>`}</div>
      <div class="buttons">
        ${s && c ? _t(s, c).map((e) => q(this, a, e)) : N}
      </div>
      ${i ? j`<span></span>` : j`<button class="icon muted" title=${H(a, "remove_valve")} @click=${() => this.removeValve(n.key)}>
            ✕
          </button>`}
    </div>`;
	}
	renderBlocks(e, t, n) {
		let r = this.hass;
		return e.start_times.length ? j`<div class="chips">
        ${e.start_times.map((e) => j`<button
              class="chip ${t.start_times.includes(e) ? "on" : ""}"
              ?disabled=${n}
              @click=${() => this.toggleValveTime(t.key, e)}
            >
              ${e}
            </button>`)}
      </div>
      ${t.start_times.length ? N : j`<div class="muted small">${H(r, "manual_only")}</div>`}` : j`<span class="muted small">${H(r, "add_times_first")}</span>`;
	}
	renderValveStatus(e) {
		let t = `${dt[e.state]} ${gt(this.hass, e).toLocaleLowerCase()}`;
		return j`<div class="state-${e.state}">${t}</div>
      ${e.open ? ht(e.open) : N}`;
	}
	static {
		this.styles = [
			X,
			it,
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
        flex: 1;
      }
      .table {
        overflow-x: auto;
        margin-top: 8px;
      }
      .valve {
        display: grid;
        grid-template-columns:
          24px minmax(160px, 1fr) minmax(200px, 1fr) 90px minmax(170px, 1fr)
          150px 96px 32px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        min-width: 960px;
      }
      .valve.head {
        padding: 4px 0;
      }
      .valve.dragging {
        opacity: 0.5;
      }
      .handle {
        cursor: grab;
        user-select: none;
      }
      .buttons {
        display: flex;
        gap: 4px;
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
    `
		];
	}
});
//#endregion
//#region src/panel/settings-view.ts
var Rt = "notify.mobile_app_";
function zt(e) {
	return {
		...e,
		notify_targets: [...e.notify_targets]
	};
}
function Bt(e) {
	return JSON.stringify([
		e.global_max_valves,
		e.notify_targets,
		e.rain_sensor,
		e.rain_past_hours,
		e.rain_past_threshold_mm,
		e.weather_entity,
		e.rain_forecast_hours,
		e.rain_forecast_threshold_mm
	]);
}
function Vt(e) {
	return e.slice(18).replaceAll("_", " ");
}
J("irrigation-settings-view", class extends z {
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
		return this._draft !== void 0 && Bt(this._draft) !== this.baseline;
	}
	willUpdate(e) {
		this.snapshot && (!this._draft || e.has("snapshot") && !this.dirty && !this.saving) && this.reset(this.snapshot.settings);
	}
	reset(e) {
		this._draft = zt(e), this.baseline = Bt(e), e.global_max_valves !== null && (this.lastMax = e.global_max_valves);
	}
	patch(e) {
		if (!this._draft) return;
		this._draft = {
			...this._draft,
			...e
		};
		let t = Object.keys(e);
		this._errors = Object.fromEntries(Object.entries(this._errors).filter(([e]) => !t.some((t) => e === t || e.startsWith(`${t}.`)))), W(this, "settings-dirty", this.dirty);
	}
	async save() {
		if (this._draft && !this.saving) {
			this.saving = !0;
			try {
				let e = await Ae(this.hass, this._draft);
				if (e.errors.length || !e.settings) {
					this._errors = Ue(this.hass, e.errors), G(this, H(this.hass, "settings_not_saved"));
					return;
				}
				this._errors = {}, this.reset(e.settings), G(this, H(this.hass, "settings_saved")), W(this, "settings-dirty", !1);
			} catch (e) {
				G(this, K(this.hass, e));
			} finally {
				this.saving = !1;
			}
		}
	}
	toggleLimit(e) {
		let t = this._draft?.global_max_valves;
		typeof t == "number" && (this.lastMax = t), this.patch({ global_max_valves: e ? Math.max(1, this.lastMax) : null });
	}
	addTarget(e) {
		let t = e.target, n = t.value;
		t.value = "", this._draft && n && this.patch({ notify_targets: [...this._draft.notify_targets, n] });
	}
	removeTarget(e) {
		this._draft && this.patch({ notify_targets: this._draft.notify_targets.filter((t) => t !== e) });
	}
	error(e) {
		let t = this._errors[e];
		return t ? j`<div class="error-text">${t}</div>` : N;
	}
	render() {
		let e = this._draft;
		if (!this.hass || !e) return N;
		let t = !(this.hass.user?.is_admin ?? !1);
		return j`${t ? j`<div class="banner info">${H(this.hass, "read_only")}</div>` : N}
    ${this.renderConcurrency(e, t)} ${this.renderNotifications(e, t)}
    ${this.renderRain(e, t)}`;
	}
	renderConcurrency(e, t) {
		let n = this.hass, r = e.global_max_valves !== null;
		return j`<div class="card section">
      <div class="label">${H(n, "concurrency")}</div>
      <ha-selector
        .hass=${n}
        .selector=${{ boolean: {} }}
        .label=${H(n, "limit_global")}
        .value=${r}
        .disabled=${t}
        @value-changed=${(e) => this.toggleLimit(Y(e) ?? !1)}
      ></ha-selector>
      ${r ? j`<ha-selector
            class="narrow-field"
            .hass=${n}
            .selector=${{ number: {
			min: 1,
			max: 50,
			mode: "box"
		} }}
            .label=${H(n, "global_max")}
            .value=${e.global_max_valves}
            .disabled=${t}
            @value-changed=${(e) => {
			let t = Math.trunc(Y(e) ?? 0);
			this.lastMax = t, this.patch({ global_max_valves: t });
		}}
          ></ha-selector>` : N}
      ${this.error("global_max_valves")}
      <div class="muted small">${H(n, "global_off_help")}</div>
    </div>`;
	}
	renderNotifications(e, t) {
		let n = this.hass, r = Object.keys(n.services.notify ?? {}).map((e) => `notify.${e}`).filter((t) => t.startsWith(Rt) && !e.notify_targets.includes(t)).sort();
		return j`<div class="card section">
      <div class="label">${H(n, "notifications")}</div>
      <div class="muted small help">${H(n, "notifications_help")}</div>
      <div class="chips">
        ${e.notify_targets.map((e) => j`<button class="chip on" ?disabled=${t} title=${e} @click=${() => this.removeTarget(e)}>
              📱 ${Vt(e)}${t ? "" : " ✕"}
            </button>`)}
        ${!t && r.length ? j`<select @change=${this.addTarget}>
              <option value="" selected>${H(n, "add_target")}</option>
              ${r.map((e) => j`<option .value=${e}>📱 ${Vt(e)}</option>`)}
            </select>` : N}
      </div>
      ${e.notify_targets.map((e, t) => this.error(`notify_targets.${t}`))}
      ${!r.length && !e.notify_targets.length ? j`<div class="muted small">${H(n, "no_targets")}</div>` : N}
    </div>`;
	}
	renderRain(e, t) {
		let n = this.hass, r = !this._errors.rain_past_hours && !this._errors.rain_past_threshold_mm, i = !this._errors.rain_forecast_hours && !this._errors.rain_forecast_threshold_mm;
		return j`<div class="card section">
      <div class="label">${H(n, "rain")}</div>
      <div class="muted small help">${H(n, "rain_help")}</div>

      <div class="subtitle">${H(n, "rain_past")}</div>
      <ha-selector
        .hass=${n}
        .selector=${{ entity: { domain: "sensor" } }}
        .label=${H(n, "rain_sensor")}
        .value=${e.rain_sensor ?? void 0}
        .disabled=${t}
        @value-changed=${(e) => this.patch({ rain_sensor: Y(e) || null })}
      ></ha-selector>
      ${this.error("rain_sensor")}
      <div class="pair">
        <div>
          <ha-selector
            .hass=${n}
            .selector=${{ number: {
			min: 1,
			max: 24,
			mode: "box"
		} }}
            .label=${H(n, "rain_past_hours")}
            .value=${e.rain_past_hours}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_past_hours: Math.trunc(Y(e) ?? 0) })}
          ></ha-selector>
          ${this.error("rain_past_hours")}
        </div>
        <div>
          <ha-selector
            .hass=${n}
            .selector=${{ number: {
			min: 0,
			step: .1,
			mode: "box",
			unit_of_measurement: "mm"
		} }}
            .label=${H(n, "rain_past_threshold")}
            .value=${e.rain_past_threshold_mm}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_past_threshold_mm: Y(e) ?? 0 })}
          ></ha-selector>
          ${this.error("rain_past_threshold_mm")}
        </div>
      </div>
      ${r ? j`<div class="muted small rule">
            ${H(n, "rain_past_rule", {
			mm: e.rain_past_threshold_mm,
			hours: e.rain_past_hours
		})}
          </div>` : N}

      <div class="subtitle">${H(n, "rain_forecast")}</div>
      <ha-selector
        .hass=${n}
        .selector=${{ entity: { domain: "weather" } }}
        .label=${H(n, "weather_entity")}
        .value=${e.weather_entity ?? void 0}
        .disabled=${t}
        @value-changed=${(e) => this.patch({ weather_entity: Y(e) || null })}
      ></ha-selector>
      ${this.error("weather_entity")}
      <div class="pair">
        <div>
          <ha-selector
            .hass=${n}
            .selector=${{ number: {
			min: 1,
			max: 48,
			mode: "box"
		} }}
            .label=${H(n, "rain_forecast_hours")}
            .value=${e.rain_forecast_hours}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_forecast_hours: Math.trunc(Y(e) ?? 0) })}
          ></ha-selector>
          ${this.error("rain_forecast_hours")}
        </div>
        <div>
          <ha-selector
            .hass=${n}
            .selector=${{ number: {
			min: 0,
			step: .1,
			mode: "box",
			unit_of_measurement: "mm"
		} }}
            .label=${H(n, "rain_forecast_threshold")}
            .value=${e.rain_forecast_threshold_mm}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_forecast_threshold_mm: Y(e) ?? 0 })}
          ></ha-selector>
          ${this.error("rain_forecast_threshold_mm")}
        </div>
      </div>
      ${i ? j`<div class="muted small rule">
            ${H(n, "rain_forecast_rule", {
			mm: e.rain_forecast_threshold_mm,
			hours: e.rain_forecast_hours
		})}
          </div>` : N}
    </div>`;
	}
	static {
		this.styles = [X, o`
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
}), J("irrigation-scheduler-panel", class extends z {
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
		super(), this.store = new Ye(this), this.narrow = !1, this._tab = "zones", this._zoneId = void 0, this._ready = !1, this._settingsDirty = !1;
	}
	connectedCallback() {
		super.connectedCallback(), rt().then(() => {
			this._ready = !0;
		});
	}
	render() {
		if (!this.hass) return N;
		let { snapshot: e } = this.store.state;
		return this._tab === "zones" && this._zoneId !== void 0 && e && this._ready ? j`<irrigation-zone-editor
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
      ></irrigation-zone-editor>` : j`${this.renderToolbar()}
      <div class="content ${this._tab}">${this.renderBody()}</div>`;
	}
	renderToolbar() {
		let e = this.hass, { snapshot: t } = this.store.state, n = e.user?.is_admin ?? !1, r = N;
		return this._tab === "zones" && t ? r = q(this, e, {
			action: "pause",
			run: (e) => Ne(e)
		}, H(e, "pause_all")) : this._tab === "settings" && t && n && (r = j`<button
        class="filled"
        ?disabled=${!this._settingsDirty || !e.connected}
        @click=${this.saveSettings}
      >
        ${H(e, "save")}
      </button>`), j`<div class="toolbar">
      <ha-menu-button .hass=${e} .narrow=${this.narrow}></ha-menu-button>
      <span class="title">${H(e, "title")}</span>
      <button class="tab ${this._tab === "zones" ? "active" : ""}" @click=${() => this.selectTab("zones")}>
        ${H(e, "tab_zones")}
      </button>
      <button class="tab ${this._tab === "settings" ? "active" : ""}" @click=${() => this.selectTab("settings")}>
        ${H(e, "tab_settings")}
      </button>
      <span class="spacer"></span>
      ${r}
    </div>`;
	}
	renderBody() {
		let e = this.hass, { snapshot: t, error: n } = this.store.state;
		if (n === "not_loaded") return j`<div class="banner warning">${H(e, "not_loaded")}</div>`;
		if (n) return j`<div class="banner error">${H(e, "load_error")}</div>`;
		if (!t || !this._ready) return j`<div class="muted">${H(e, "loading")}</div>`;
		let r = e.connected ? N : j`<div class="banner error">${H(e, "disconnected")}</div>`;
		return this._tab === "settings" ? j`${r}<irrigation-settings-view
          .hass=${e}
          .snapshot=${t}
          @settings-dirty=${(e) => {
			this._settingsDirty = e.detail;
		}}
        ></irrigation-settings-view>` : j`${r}<irrigation-zone-list
        .hass=${e}
        .snapshot=${t}
        @zone-open=${(e) => {
			this._zoneId = e.detail.zoneId;
		}}
      ></irrigation-zone-list>`;
	}
	selectTab(e) {
		e !== this._tab && (!this._settingsDirty || window.confirm(H(this.hass, "confirm_discard_settings"))) && (this._settingsDirty = !1, this._zoneId = void 0, this._tab = e);
	}
	async saveSettings() {
		await this.renderRoot.querySelector("irrigation-settings-view")?.save();
	}
	static {
		this.styles = [
			X,
			it,
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
    `
		];
	}
});
//#endregion
