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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, ee = h.trustedTypes, te = ee ? ee.emptyScript : "", ne = h.reactiveElementPolyfillSupport, g = (e, t) => e, re = {
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
}, ie = (e, t) => !l(e, t), ae = {
	attribute: !0,
	type: String,
	converter: re,
	reflect: !1,
	useDefault: !1,
	hasChanged: ie
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var _ = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = ae) {
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
		return this.elementProperties.get(e) ?? ae;
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
			let i = (n.converter?.toAttribute === void 0 ? re : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? re : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ie)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
_.elementStyles = [], _.shadowRootOptions = { mode: "open" }, _[g("elementProperties")] = /* @__PURE__ */ new Map(), _[g("finalized")] = /* @__PURE__ */ new Map(), ne?.({ ReactiveElement: _ }), (h.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var oe = globalThis, se = (e) => e, v = oe.trustedTypes, ce = v ? v.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, y = "$lit$", b = `lit$${Math.random().toFixed(9).slice(2)}$`, le = "?" + b, ue = `<${le}>`, x = document, S = () => x.createComment(""), C = (e) => e === null || typeof e != "object" && typeof e != "function", de = Array.isArray, fe = (e) => de(e) || typeof e?.[Symbol.iterator] == "function", pe = "[ 	\n\f\r]", w = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, me = /-->/g, he = />/g, T = RegExp(`>|${pe}(?:([^\\s"'>=/]+)(${pe}*=${pe}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), ge = /'/g, _e = /"/g, ve = /^(?:script|style|textarea|title)$/i, E = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), D = Symbol.for("lit-noChange"), O = Symbol.for("lit-nothing"), ye = /* @__PURE__ */ new WeakMap(), k = x.createTreeWalker(x, 129);
function be(e, t) {
	if (!de(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ce === void 0 ? t : ce.createHTML(t);
}
var xe = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = w;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === w ? c[1] === "!--" ? o = me : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = T) : (ve.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = T) : o = he : o === T ? c[0] === ">" ? (o = i ?? w, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? T : c[3] === "\"" ? _e : ge) : o === _e || o === ge ? o = T : o === me || o === he ? o = w : (o = T, i = void 0);
		let d = o === T && e[t + 1].startsWith("/>") ? " " : "";
		a += o === w ? n + ue : l >= 0 ? (r.push(s), n.slice(0, l) + y + n.slice(l) + b + d) : n + b + (l === -2 ? t : d);
	}
	return [be(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Se = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = xe(t, n);
		if (this.el = e.createElement(l, r), k.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = k.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(y)) {
					let t = u[o++], n = i.getAttribute(e).split(b), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? we : r[1] === "?" ? Te : r[1] === "@" ? Ee : M
					}), i.removeAttribute(e);
				} else e.startsWith(b) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ve.test(i.tagName)) {
					let e = i.textContent.split(b), t = e.length - 1;
					if (t > 0) {
						i.textContent = v ? v.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], S()), k.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], S());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === le) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(b, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += b.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = x.createElement("template");
		return n.innerHTML = e, n;
	}
};
function A(e, t, n = e, r) {
	if (t === D) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = C(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = A(e, i._$AS(e, t.values), i, r)), t;
}
var Ce = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? x).importNode(t, !0);
		k.currentNode = r;
		let i = k.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new j(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new De(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = k.nextNode(), a++);
		}
		return k.currentNode = x, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, j = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = O, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = A(this, e, t), C(e) ? e === O || e == null || e === "" ? (this._$AH !== O && this._$AR(), this._$AH = O) : e !== this._$AH && e !== D && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? fe(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== O && C(this._$AH) ? this._$AA.nextSibling.data = e : this.T(x.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Se.createElement(be(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Ce(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = ye.get(e.strings);
		return t === void 0 && ye.set(e.strings, t = new Se(e)), t;
	}
	k(t) {
		de(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(S()), this.O(S()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = se(e).nextSibling;
			se(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, M = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = O, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = O;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = A(this, e, t, 0), a = !C(e) || e !== this._$AH && e !== D, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = A(this, r[n + o], t, o), s === D && (s = this._$AH[o]), a ||= !C(s) || s !== this._$AH[o], s === O ? e = O : e !== O && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === O ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, we = class extends M {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === O ? void 0 : e;
	}
}, Te = class extends M {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== O);
	}
}, Ee = class extends M {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = A(this, e, t, 0) ?? O) === D) return;
		let n = this._$AH, r = e === O && n !== O || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== O && (n === O || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, De = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		A(this, e);
	}
}, Oe = {
	M: y,
	P: b,
	A: le,
	C: 1,
	L: xe,
	R: Ce,
	D: fe,
	V: A,
	I: j,
	H: M,
	N: Te,
	U: Ee,
	B: we,
	F: De
}, ke = oe.litHtmlPolyfillSupport;
ke?.(Se, j), (oe.litHtmlVersions ??= []).push("3.3.3");
var Ae = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new j(t.insertBefore(S(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, je = globalThis, N = class extends _ {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ae(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return D;
	}
};
N._$litElement$ = !0, N.finalized = !0, je.litElementHydrateSupport?.({ LitElement: N });
var Me = je.litElementPolyfillSupport;
Me?.({ LitElement: N }), (je.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var P = "irrigation_scheduler", Ne = `${P}/subscribe`, Pe = (e) => e.callWS({ type: `${P}/list` });
function Fe(e, t) {
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
		type: `${P}/save_zone`,
		zone: n
	});
}
var Ie = (e, t) => e.callWS({
	type: `${P}/delete_zone`,
	zone_id: t
});
function Le(e, t) {
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
		type: `${P}/save_settings`,
		settings: n
	});
}
var Re = (e, t) => e.callWS({
	type: `${P}/run_zone`,
	zone_id: t
}), ze = (e, t) => e.callWS({
	type: `${P}/run_valve`,
	entity_id: t
}), Be = (e, t) => e.callWS({
	type: `${P}/stop`,
	...t ? { zone_id: t } : {}
}), Ve = (e, t) => e.callWS({
	type: `${P}/pause_valve`,
	entity_id: t
}), He = (e, t, n) => e.callWS({
	type: `${P}/set_valve_enabled`,
	entity_id: t,
	enabled: n
}), Ue = (e, t, n) => e.callWS({
	type: `${P}/set_zone_enabled`,
	zone_id: t,
	enabled: n
}), We = {
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
	rule_hours_48: "Entre 1 y 48",
	rule_positive: "Debe ser mayor que 0",
	rule_unknown: "Valor no válido",
	concurrency: "Simultaneidad",
	limit_global: "Limitar válvulas abiertas en toda la instalación",
	global_max: "Máximo global",
	global_off_help: "Desactivado = sin límite global.",
	notifications: "Notificaciones",
	notifications_help: "Avisos de fallos de válvula. Pulsa un móvil para activarlo o quitarlo.",
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
	card_bad_zones: "«zones» debe ser una lista de IDs de zona.",
	card_all_zones: "Sin zonas elegidas, la tarjeta muestra todas.",
	card_zones: "Zonas",
	card_order_help: "El orden de los chips es el orden en la tarjeta.",
	card_title: "Título (opcional)"
}, Ge = {
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
	rule_hours_48: "Between 1 and 48",
	rule_positive: "Must be greater than 0",
	rule_unknown: "Invalid value",
	concurrency: "Concurrency",
	limit_global: "Limit open valves across the whole installation",
	global_max: "Global maximum",
	global_off_help: "Off = no global limit.",
	notifications: "Notifications",
	notifications_help: "Valve failure alerts. Tap a phone to turn it on or off.",
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
	card_bad_zones: "«zones» must be a list of zone IDs.",
	card_all_zones: "With no zones picked, the card shows all of them.",
	card_zones: "Zones",
	card_order_help: "Chip order is the order in the card.",
	card_title: "Title (optional)"
};
function Ke(e) {
	return (e?.locale?.language ?? e?.language ?? document.documentElement.lang)?.startsWith("es") ? "es" : "en";
}
function F(e, t, n = {}) {
	return (Ke(e) === "es" ? We[t] : Ge[t]).replace(/\{(\w+)\}/g, (e, t) => t in n ? String(n[t]) : e);
}
function qe(e) {
	return Ke(e) === "es" ? [
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
function I(e, t) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: t,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(e);
}
function Je(e, t) {
	if (!t) return "—";
	let n = e.config.time_zone, r = Ke(e), i = new Date(t), a = new Intl.DateTimeFormat(r, {
		timeZone: n,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).format(i), o = /* @__PURE__ */ new Date();
	return I(i, n) === I(o, n) ? F(e, "today", { time: a }) : I(i, n) === I(new Date(o.getTime() + 864e5), n) ? F(e, "tomorrow", { time: a }) : `${new Intl.DateTimeFormat(r, {
		timeZone: n,
		weekday: "short"
	}).format(i)} ${a}`;
}
function L(e) {
	let t = Math.max(0, Math.round(e)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${n}:${String(r).padStart(2, "0")}:${i}` : `${r}:${i}`;
}
function Ye(e, t) {
	if (t.rule === "V10" || t.rule === "V11") return String(t.path[t.path.length - 1]).endsWith("_hours") ? F(e, t.rule === "V10" ? "rule_hours_24" : "rule_hours_48") : F(e, "rule_positive");
	let n = `rule_${t.rule}`;
	return n in We ? F(e, n) : F(e, "rule_unknown");
}
function Xe(e, t) {
	let n = {};
	for (let r of t) n[r.path.join(".")] ??= Ye(e, r);
	return n;
}
//#endregion
//#region src/store.ts
var Ze = 3e4, Qe = /* @__PURE__ */ new WeakMap();
function $e(e, t) {
	e.state = t;
	for (let n of e.listeners) n(t);
}
function et(e, t) {
	let n = e.subscribeMessage((e) => $e(t, { snapshot: e }), { type: Ne });
	t.unsubscribe = n, n.catch((r) => {
		if (t.unsubscribe !== n) return;
		t.unsubscribe = void 0;
		let i = r?.code;
		$e(t, { error: i === "not_loaded" ? "not_loaded" : "unknown" }), t.retry = window.setTimeout(() => {
			t.retry = void 0, t.listeners.size && et(e, t);
		}, Ze);
	});
}
function tt(e, t) {
	let n = Qe.get(e);
	n || (n = {
		state: {},
		listeners: /* @__PURE__ */ new Set()
	}, Qe.set(e, n));
	let r = n;
	return r.listeners.add(t), (r.state.snapshot || r.state.error) && t(r.state), !r.unsubscribe && r.retry === void 0 && et(e, r), () => {
		if (r.listeners.delete(t), r.listeners.size) return;
		window.clearTimeout(r.retry), r.retry = void 0;
		let e = r.unsubscribe;
		r.unsubscribe = void 0, r.state = {}, e?.then((e) => e()).catch(() => void 0);
	};
}
var R = class {
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
		e !== this.connection && (this.release?.(), this.connection = e, this.state = {}, this.release = e ? tt(e, (e) => {
			this.state = e, this.host.requestUpdate();
		}) : void 0);
	}
}, z = class {
	constructor(e) {
		this.host = e, e.addController(this);
	}
	hostConnected() {
		this.timer = window.setInterval(() => this.host.requestUpdate(), 1e3);
	}
	hostDisconnected() {
		window.clearInterval(this.timer), this.timer = void 0;
	}
}, nt = "M8,5.14V19.14L19,12.14L8,5.14Z", rt = {
	run: nt,
	resume: nt,
	pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
	stop: "M18,18H6V6H18V18Z"
}, it = {
	run: "action_run",
	resume: "action_resume",
	pause: "action_pause",
	stop: "action_stop"
};
function B(e, t, n) {
	e.dispatchEvent(new CustomEvent(t, {
		detail: n,
		bubbles: !0,
		composed: !0
	}));
}
function V(e, t) {
	let n = e.isConnected ? e : document.querySelector("home-assistant");
	n && B(n, "hass-notification", { message: t });
}
function H(e, t) {
	let n = t?.message;
	return typeof n == "string" && n ? n : F(e, "command_failed");
}
async function at(e, t, n) {
	try {
		await n(t);
	} catch (n) {
		V(e, H(t, n));
	}
}
function U(e, t, n, r) {
	let i = F(t, it[n.action]);
	return E`<button
    class="control ${n.action === "stop" ? "danger" : ""}"
    title=${i}
    aria-label=${r ?? i}
    ?disabled=${!t.connected}
    @click=${(r) => {
		r.stopPropagation(), at(e, t, n.run);
	}}
  >
    ${W(rt[n.action])}${r ? E`<span class="text">${r}</span>` : O}
  </button>`;
}
function W(e) {
	return E`<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d=${e}></path></svg>`;
}
//#endregion
//#region src/shared/ha-components.ts
function ot(e, t) {
	customElements.get(e) || customElements.define(e, t);
}
function G(e, t) {
	customElements.whenDefined("home-assistant").then(() => ot(e, t));
}
function K(e) {
	return e.detail?.value;
}
var st = 1e4, ct;
async function lt() {
	if (customElements.get("ha-selector")) return;
	await customElements.whenDefined("partial-panel-resolver");
	let e = document.createElement("partial-panel-resolver");
	e.hass = { panels: [{
		url_path: "tmp",
		component_name: "config"
	}] }, e._updateRoutes?.(), await e.routerOptions.routes.tmp.load(), await customElements.whenDefined("ha-panel-config"), await document.createElement("ha-panel-config").routerOptions.routes.automation.load(), await customElements.whenDefined("ha-selector");
}
function ut() {
	return ct ??= Promise.race([lt().catch((e) => console.warn("Irrigation Scheduler: ha-selector", e)), new Promise((e) => window.setTimeout(e, st))]), ct;
}
//#endregion
//#region src/shared/styles.ts
var q = o`
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
`, dt = o`
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
`, ft = "irrigation-confirm-dialog";
G(ft, class extends N {
	firstUpdated() {
		this.renderRoot.querySelector("dialog")?.showModal();
	}
	close(e) {
		this.renderRoot.querySelector("dialog")?.close(), this.done(e);
	}
	render() {
		let { text: e, confirmText: t, destructive: n } = this.options;
		return E`<dialog
      @cancel=${(e) => {
			e.preventDefault(), this.close(!1);
		}}
      @click=${(e) => {
			e.target === e.currentTarget && this.close(!1);
		}}
    >
      <div class="body">${e}</div>
      <div class="actions">
        <button @click=${() => this.close(!1)}>${F(this.hass, "cancel")}</button>
        <button class=${n ? "destructive" : "filled"} autofocus @click=${() => this.close(!0)}>
          ${t}
        </button>
      </div>
    </dialog>`;
	}
	static {
		this.styles = [q, o`
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
function J(e, t) {
	return new Promise((n) => {
		let r = document.createElement(ft);
		r.hass = e, r.options = t, r.done = (e) => {
			r.remove(), n(e);
		}, document.body.append(r);
	});
}
//#endregion
//#region node_modules/lit-html/directive.js
var pt = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6
}, mt = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), ht = class {
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
}, gt = "important", _t = " !" + gt, vt = mt(class extends ht {
	constructor(e) {
		if (super(e), e.type !== pt.ATTRIBUTE || e.name !== "style" || e.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
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
				let t = typeof r == "string" && r.endsWith(_t);
				e.includes("-") || t ? n.setProperty(e, t ? r.slice(0, -11) : r, t ? gt : "") : n[e] = r;
			}
		}
		return D;
	}
}), yt = {
	running: "💧",
	manual: "💧",
	queued: "⏳",
	idle: "○",
	stopped: "⊘"
}, bt = {
	running: "status_running",
	manual: "status_manual",
	queued: "status_queued",
	idle: "status_idle",
	stopped: "status_stopped"
};
function xt(e, t) {
	let n = t.open_valves.find((t) => t.entity_id === e.entity_id);
	return n ? {
		state: "running",
		open: n
	} : t.manual_on.some((t) => t.entity_id === e.entity_id) ? { state: "manual" } : t.pending.some((t) => t.entity_id === e.entity_id) ? { state: "queued" } : { state: e.enabled ? "idle" : "stopped" };
}
function Y(e) {
	return (Date.parse(e.ends_at) - Date.now()) / 1e3;
}
function St(e) {
	let t = Date.parse(e.started_at), n = Date.parse(e.ends_at) - t;
	return E`<div class="progress"><div style=${vt({ width: `${(n > 0 ? Math.min(1, Math.max(0, (Date.now() - t) / n)) : 1) * 100}%` })}></div></div>`;
}
function Ct(e, t) {
	return t.open ? F(e, "remaining", { time: L(Y(t.open)) }) : F(e, bt[t.state]);
}
function wt(e, t) {
	let n = e.entity_id, r = {
		action: "stop",
		run: (e) => He(e, n, !1)
	};
	switch (t.state) {
		case "running":
		case "manual":
		case "queued": return [{
			action: "pause",
			run: (e) => Ve(e, n)
		}, r];
		case "idle": return [{
			action: "run",
			run: (e) => ze(e, n)
		}, r];
		case "stopped": return [{
			action: "resume",
			run: (e) => He(e, n, !0)
		}];
	}
}
//#endregion
//#region src/shared/zone-status.ts
var Tt = {
	running: "status_running",
	queued: "status_queued",
	idle: "status_idle",
	stopped: "status_stopped"
}, Et = {
	running: "💧",
	queued: "⏳",
	idle: "○",
	stopped: "⊘"
}, Dt = {
	run: "zone_run",
	resume: "zone_resume",
	pause: "zone_pause",
	stop: "zone_stop"
};
function Ot(e, t) {
	return e.enabled ? e.status === "idle" && t.manual_on.some((t) => t.zone_id === e.zone_id) ? "running" : e.status : "stopped";
}
function kt(e, t) {
	return E`<span class="badge ${t}">${F(e, Tt[t])}</span>`;
}
function At(e, t) {
	let n = qe(e);
	return `${t.days.length === 7 ? F(e, "every_day") : t.days.map((e) => n[e]).join(" ")} · ${t.start_times.length ? t.start_times.join(", ") : F(e, "no_times")} · ${t.valves.length === 1 ? F(e, "valves_one") : F(e, "valves_count", { n: t.valves.length })}`;
}
function jt(e) {
	if (e.batch_started_at && e.batch_ends_at) return {
		started_at: e.batch_started_at,
		ends_at: e.batch_ends_at
	};
}
function Mt(e, t) {
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
function Nt(e, t) {
	let n = e.zone_id, r = {
		action: "stop",
		run: (e) => Ue(e, n, !1)
	};
	switch (t) {
		case "running":
		case "queued": return [{
			action: "pause",
			run: (e) => Be(e, n)
		}, r];
		case "idle": return [{
			action: "run",
			run: (e) => Re(e, n)
		}, r];
		case "stopped": return [{
			action: "resume",
			run: (e) => Ue(e, n, !0)
		}];
	}
}
G("irrigation-zone-list", class extends N {
	static {
		this.properties = {
			hass: { attribute: !1 },
			snapshot: { attribute: !1 }
		};
	}
	constructor() {
		super(), new z(this);
	}
	render() {
		if (!this.hass || !this.snapshot) return O;
		let e = this.hass.user?.is_admin ?? !1, t = this.snapshot.zones;
		return E`
      <ha-card>
        ${t.length ? t.map((e) => this.renderRow(e)) : E`<div class="empty muted">${F(this.hass, "empty_list")}</div>`}
      </ha-card>
      ${e ? E`<button class="fab filled" @click=${() => this.open(null)}>${F(this.hass, "add_zone")}</button>` : O}
    `;
	}
	renderRow(e) {
		let t = this.hass, n = Ot(e, this.snapshot), r = n === "running" ? Mt(e, this.snapshot) : void 0, i = n === "running" ? jt(e) : void 0;
		return E`
      <div class="list-row ${n === "stopped" ? "stopped" : ""}" @click=${() => this.open(e.zone_id)}>
        <div class="main">
          <div class="name">${e.name}</div>
          <div class="muted small">${At(t, e)}</div>
        </div>
        <div class="status">
          ${kt(t, n)}
          ${i ? E`<div class="small">${F(t, "batch")} · ${L(Y(i))}</div>` : r ? E`<div class="small">${r.valve.name}</div>` : O}
        </div>
        <div class="next small muted">${Je(t, e.next_run)}</div>
        <div class="buttons">${Nt(e, n).map((e) => U(this, t, e))}</div>
        <span class="chevron muted">›</span>
      </div>
    `;
	}
	open(e) {
		B(this, "zone-open", { zoneId: e });
	}
	static {
		this.styles = [q, o`
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
      @media (max-width: 600px) {
        /* móvil: dos líneas; arriba nombre y estado, abajo próximo riego y botones */
        .list-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          grid-template-areas:
            "main status chevron"
            "next buttons chevron";
          column-gap: 8px;
          row-gap: 8px;
          padding: 12px;
        }
        .main {
          grid-area: main;
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
    `];
	}
});
//#endregion
//#region node_modules/lit-html/directive-helpers.js
var { I: Pt } = Oe, Ft = (e) => e, It = () => document.createComment(""), X = (e, t, n) => {
	let r = e._$AA.parentNode, i = t === void 0 ? e._$AB : t._$AA;
	if (n === void 0) n = new Pt(r.insertBefore(It(), i), r.insertBefore(It(), i), e, e.options);
	else {
		let t = n._$AB.nextSibling, a = n._$AM, o = a !== e;
		if (o) {
			let t;
			n._$AQ?.(e), n._$AM = e, n._$AP !== void 0 && (t = e._$AU) !== a._$AU && n._$AP(t);
		}
		if (t !== i || o) {
			let e = n._$AA;
			for (; e !== t;) {
				let t = Ft(e).nextSibling;
				Ft(r).insertBefore(e, i), e = t;
			}
		}
	}
	return n;
}, Z = (e, t, n = e) => (e._$AI(t, n), e), Lt = {}, Rt = (e, t = Lt) => e._$AH = t, zt = (e) => e._$AH, Bt = (e) => {
	e._$AR(), e._$AA.remove();
}, Vt = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i = t; i <= n; i++) r.set(e[i], i);
	return r;
}, Ht = mt(class extends ht {
	constructor(e) {
		if (super(e), e.type !== pt.CHILD) throw Error("repeat() can only be used in text expressions");
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
		let i = zt(e), { values: a, keys: o } = this.dt(t, n, r);
		if (!Array.isArray(i)) return this.ut = o, a;
		let s = this.ut ??= [], c = [], l, u, d = 0, f = i.length - 1, p = 0, m = a.length - 1;
		for (; d <= f && p <= m;) if (i[d] === null) d++;
		else if (i[f] === null) f--;
		else if (s[d] === o[p]) c[p] = Z(i[d], a[p]), d++, p++;
		else if (s[f] === o[m]) c[m] = Z(i[f], a[m]), f--, m--;
		else if (s[d] === o[m]) c[m] = Z(i[d], a[m]), X(e, c[m + 1], i[d]), d++, m--;
		else if (s[f] === o[p]) c[p] = Z(i[f], a[p]), X(e, i[d], i[f]), f--, p++;
		else if (l === void 0 && (l = Vt(o, p, m), u = Vt(s, d, f)), l.has(s[d])) {
			if (l.has(s[f])) {
				let t = u.get(o[p]), n = t === void 0 ? null : i[t];
				if (n === null) {
					let t = X(e, i[d]);
					Z(t, a[p]), c[p] = t;
				} else c[p] = Z(n, a[p]), X(e, i[d], n), i[t] = null;
				p++;
			} else Bt(i[f]), f--;
		} else Bt(i[d]), d++;
		for (; p <= m;) {
			let t = X(e, c[m + 1]);
			Z(t, a[p]), c[p++] = t;
		}
		for (; d <= f;) {
			let e = i[d++];
			e !== null && Bt(e);
		}
		return this.ut = o, Rt(e, c), D;
	}
}), Ut = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], Wt = 0, Gt = "M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z";
function Kt(e) {
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
			key: Wt++
		}))
	};
}
function qt() {
	return {
		zone_id: null,
		name: "",
		enabled: !0,
		mode: "manual",
		days: [...Ut],
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
function Q(e) {
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
G("irrigation-zone-editor", class extends N {
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
		super(), this.loaded = !1, this.loadedId = null, this.baseline = "", this.seen = !1, this.deleting = !1, this.narrow = !1, this._draft = void 0, this._errors = {}, this._banner = void 0, this._external = !1, this._saving = !1, this._newTime = "", this._dragKey = void 0, new z(this);
	}
	get dirty() {
		return this._draft !== void 0 && Q(this._draft) !== this.baseline;
	}
	liveZone() {
		return this.loadedId === null ? void 0 : this.snapshot.zones.find((e) => e.zone_id === this.loadedId);
	}
	willUpdate(e) {
		this.hass && this.snapshot && (!this.loaded || e.has("zoneId") && this.zoneId !== this.loadedId ? this.load() : e.has("snapshot") && this.checkExternal());
	}
	load() {
		if (this.loaded = !0, this.loadedId = this.zoneId, this.deleting = !1, this._errors = {}, this._banner = void 0, this._external = !1, this.zoneId === null) {
			this._draft = qt(), this.baseline = Q(this._draft), this.seen = !1;
			return;
		}
		let e = this.liveZone();
		if (!e) {
			this._draft = void 0, this.leaveDeleted();
			return;
		}
		this.seen = !0, this._draft = Kt(e), this.baseline = Q(e);
	}
	checkExternal() {
		if (this._saving) return;
		let e = this.liveZone();
		if (!e) {
			this.seen && !this.deleting && this.leaveDeleted();
			return;
		}
		this.seen = !0;
		let t = Q(e);
		t !== this.baseline && (this._draft && t === Q(this._draft) ? this.baseline = t : this._external = !0);
	}
	leaveDeleted() {
		this.updateComplete.then(() => {
			V(this, F(this.hass, "zone_deleted")), B(this, "zone-close");
		});
	}
	reloadFromLive() {
		let e = this.liveZone();
		e && (this._draft = Kt(e), this.baseline = Q(e), this._external = !1, this._errors = {}, this._banner = void 0);
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
			key: Wt++
		}], !0);
	}
	async removeValve(e) {
		if (!this._draft) return;
		let t = e.name || e.entity_id || F(this.hass, "new_valve");
		await J(this.hass, {
			text: F(this.hass, "confirm_remove_valve", { name: t }),
			confirmText: F(this.hass, "confirm_remove"),
			destructive: !0
		}) && this._draft && this.setValves(this._draft.valves.filter((t) => t.key !== e.key), !0);
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
	async back() {
		(!this.dirty || await J(this.hass, {
			text: F(this.hass, "confirm_leave"),
			confirmText: F(this.hass, "confirm_leave_action"),
			destructive: !0
		})) && B(this, "zone-close");
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
			let e = await Fe(this.hass, n);
			if (e.errors.length || !e.zone) {
				this._errors = Xe(this.hass, e.errors), this._banner = F(this.hass, "not_saved");
				return;
			}
			let t = e.zone;
			t.zone_id !== this.loadedId && (this.seen = !1), this.loadedId = t.zone_id, this._draft = Kt(t), this.baseline = Q(t), this._errors = {}, this._banner = void 0, this._external = !1, V(this, F(this.hass, "saved")), B(this, "zone-saved", { zoneId: t.zone_id });
		} catch (e) {
			V(this, H(this.hass, e));
		} finally {
			this._saving = !1;
		}
	}
	async removeZone() {
		let e = this.loadedId, t = this._draft;
		if (e === null || !t) return;
		let n = this.liveZone()?.name ?? t.name;
		if (await J(this.hass, {
			text: F(this.hass, "confirm_delete", { name: n }),
			confirmText: F(this.hass, "confirm_delete_action"),
			destructive: !0
		})) {
			this.deleting = !0;
			try {
				await Ie(this.hass, e), B(this, "zone-close");
			} catch (e) {
				this.deleting = !1, V(this, H(this.hass, e));
			}
		}
	}
	error(e) {
		let t = this._errors[e];
		return t ? E`<div class="error-text">${t}</div>` : O;
	}
	render() {
		let e = this._draft;
		if (!this.hass || !this.snapshot || !e) return O;
		let t = this.hass, n = t.user?.is_admin ?? !1, r = this.liveZone(), i = r ? Ot(r, this.snapshot) : void 0;
		return E`
      <div class="toolbar">
        <button class="icon" title=${F(t, "back")} @click=${this.back}>←</button>
        <span class="title">${e.name || F(t, "new_zone")}</span>
        ${r && i ? E`${kt(t, i)}
            ${Nt(r, i).map((e) => U(this, t, e, F(t, Dt[e.action])))}` : O}
        ${n && r ? E`<button
              class="danger with-icon"
              title=${F(t, "delete_zone")}
              aria-label=${F(t, "delete_zone")}
              ?disabled=${this._saving || !t.connected}
              @click=${this.removeZone}
            >
              ${W(Gt)}<span class="text">${F(t, "delete_zone")}</span>
            </button>` : O}
        <span class="spacer"></span>
        ${n ? E`<button class="filled" ?disabled=${this._saving || !t.connected} @click=${this.save}>
              ${F(t, "save")}
            </button>` : O}
      </div>
      <div class="content">
        ${t.connected ? O : E`<div class="banner error">${F(t, "disconnected")}</div>`}
        ${n ? O : E`<div class="banner info">${F(t, "read_only")}</div>`}
        ${this._external ? E`<div class="banner warning">
              ${F(t, "external_change")}<span class="spacer"></span>
              <button @click=${this.reloadFromLive}>${F(t, "reload")}</button>
            </div>` : O}
        ${this._banner ? E`<div class="banner error">${this._banner}</div>` : O}
        <div class="columns">
          ${this.renderSchedule(e, r, !n)} ${this.renderValves(e, r, !n)}
        </div>
      </div>
    `;
	}
	renderSchedule(e, t, n) {
		let r = this.hass, i = qe(r), a = Object.entries(this._errors).filter(([e]) => e.startsWith("start_times."));
		return E`<div class="card">
      <div class="section">
        <ha-selector
          .hass=${r}
          .selector=${{ text: {} }}
          .label=${F(r, "field_name")}
          .value=${e.name}
          .required=${!0}
          .disabled=${n}
          @value-changed=${(e) => this.patch({ name: K(e) ?? "" })}
        ></ha-selector>
        ${this.error("name")}
      </div>
      <div class="section">
        <div class="label">${F(r, "rain")}</div>
        <ha-selector
          .hass=${r}
          .selector=${{ boolean: {} }}
          .label=${F(r, "rain_skip")}
          .value=${e.rain_skip}
          .disabled=${n}
          @value-changed=${(e) => this.patch({ rain_skip: K(e) ?? !1 })}
        ></ha-selector>
        <div class="muted small">${F(r, "rain_skip_help")}</div>
      </div>
      <div class="section">
        <div class="label">${F(r, "mode")}</div>
        <div class="chips">
          <button
            class="chip ${e.mode === "manual" ? "on" : ""}"
            ?disabled=${n}
            @click=${() => this.patch({ mode: "manual" })}
          >
            ${F(r, "mode_manual")}
          </button>
          <button class="chip ${e.mode === "auto" ? "on" : ""}" disabled>${F(r, "mode_auto")}</button>
        </div>
        <div class="muted small">${F(r, "auto_help")}</div>
        ${this.error("mode")}
      </div>
      <div class="section">
        <div class="label">${F(r, "days")}</div>
        <div class="chips">
          ${Ut.map((t) => E`<button
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
        <div class="label">${F(r, "start_times")}</div>
        <div class="chips">
          ${e.start_times.map((e) => E`<button class="chip on" ?disabled=${n} @click=${() => this.removeTime(e)}>
                ${e}${n ? "" : " ✕"}
              </button>`)}
        </div>
        ${n ? O : E`<div class="row add-time">
              <ha-selector
                .hass=${r}
                .selector=${{ time: { no_second: !0 } }}
                .value=${this._newTime}
                @value-changed=${(e) => {
			this._newTime = K(e) ?? "";
		}}
              ></ha-selector>
              <button ?disabled=${!this._newTime} @click=${this.addTime}>${F(r, "add_time")}</button>
            </div>`}
        ${this.error("start_times")}
        ${a.map(([t, n]) => {
			let r = Number(t.split(".")[1]);
			return E`<div class="error-text">${e.start_times[r] ?? ""} ${n}</div>`;
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
          .label=${F(r, "max_simultaneous")}
          .value=${e.max_simultaneous}
          .disabled=${n}
          @value-changed=${(e) => this.patch({ max_simultaneous: Math.trunc(K(e) ?? 0) })}
        ></ha-selector>
        ${this.error("max_simultaneous")}
      </div>
      <div class="muted small">
        ${F(r, "next_run", { when: t ? Je(r, t.next_run) : "—" })}
      </div>
    </div>`;
	}
	renderValves(e, t, n) {
		let r = this.hass;
		return E`<div class="card valves">
      <div class="row">
        <h3>${F(r, "valves")}</h3>
        <span class="muted small">${F(r, "queue_order")}</span>
        <span class="spacer"></span>
        ${n ? O : E`<button @click=${this.addValve}>${F(r, "add_valve")}</button>`}
      </div>
      <div class="table">
        <div class="valve head muted small">
          <span></span><span>${F(r, "col_name")}</span><span>${F(r, "col_entity")}</span>
          <span>${F(r, "col_minutes")}</span><span>${F(r, "col_blocks")}</span>
          <span>${F(r, "col_status")}</span><span></span><span></span>
        </div>
        ${e.valves.length ? Ht(e.valves, (e) => e.key, (r, i) => this.renderValve(e, t, r, i, n)) : E`<div class="muted small empty">${F(r, "no_valves")}</div>`}
      </div>
      ${n ? O : E`<div class="muted small note">${F(r, "picker_help")}</div>`}
      ${t ? O : E`<div class="muted small note">${F(r, "status_after_save")}</div>`}
    </div>`;
	}
	renderValve(e, t, n, r, i) {
		let a = this.hass, o = `valves.${r}`, s = n.entity_id ? t?.valves.find((e) => e.entity_id === n.entity_id) : void 0, c = s ? xt(s, this.snapshot) : void 0;
		return E`<div
      class="valve ${this._dragKey === n.key ? "dragging" : ""}"
      @dragover=${(e) => {
			this._dragKey !== void 0 && e.preventDefault();
		}}
      @drop=${(e) => {
			e.preventDefault(), this.drop(n.key);
		}}
    >
      <span
        class="handle cell muted f-handle"
        title=${F(a, "drag")}
        draggable=${i ? "false" : "true"}
        @dragstart=${(e) => {
			this._dragKey = n.key, e.dataTransfer?.setData("text/plain", String(n.key));
		}}
        @dragend=${() => {
			this._dragKey = void 0;
		}}
        >⋮⋮</span
      >
      <div class="f-name">
        <ha-selector
          .hass=${a}
          .selector=${{ text: {} }}
          .label=${F(a, "valve_name")}
          .value=${n.name}
          .required=${!0}
          .disabled=${i}
          @value-changed=${(e) => this.patchValve(n.key, { name: K(e) ?? "" })}
        ></ha-selector>
        ${this.error(`${o}.name`)}
      </div>
      <div class="f-entity">
        <ha-selector
          .hass=${a}
          .selector=${{ entity: {
			domain: "switch",
			exclude_entities: this.excluded(n.key)
		} }}
          .value=${n.entity_id || void 0}
          .disabled=${i}
          @value-changed=${(e) => this.entityChanged(n.key, K(e) ?? "")}
        ></ha-selector>
        ${this.error(`${o}.entity_id`)}
      </div>
      <div class="f-minutes">
        <ha-selector
          .hass=${a}
          .selector=${{ number: {
			min: 1,
			max: 600,
			mode: "box"
		} }}
          .label=${F(a, "valve_minutes")}
          .value=${n.duration_min}
          .disabled=${i}
          @value-changed=${(e) => this.patchValve(n.key, { duration_min: Math.trunc(K(e) ?? 0) })}
        ></ha-selector>
        ${this.error(`${o}.duration_min`)}
      </div>
      <div class="cell f-blocks">${this.renderBlocks(e, n, i)} ${this.error(`${o}.start_times`)}</div>
      <div class="cell small f-status">${c ? this.renderValveStatus(c) : E`<span class="muted">—</span>`}</div>
      <div class="buttons cell f-buttons">
        ${s && c ? wt(s, c).map((e) => U(this, a, e)) : O}
      </div>
      <div class="cell f-remove">
        ${i ? O : E`<button
              class="icon remove"
              title=${F(a, "remove_valve")}
              aria-label=${F(a, "remove_valve")}
              @click=${() => this.removeValve(n)}
            >
              ${W(Gt)}
            </button>`}
      </div>
    </div>`;
	}
	renderBlocks(e, t, n) {
		let r = this.hass;
		return e.start_times.length ? E`<div class="chips">
        ${e.start_times.map((e) => E`<button
              class="chip ${t.start_times.includes(e) ? "on" : ""}"
              ?disabled=${n}
              @click=${() => this.toggleValveTime(t.key, e)}
            >
              ${e}
            </button>`)}
      </div>
      ${t.start_times.length ? O : E`<div class="muted small">${F(r, "manual_only")}</div>`}` : E`<span class="muted small">${F(r, "add_times_first")}</span>`;
	}
	renderValveStatus(e) {
		let t = `${yt[e.state]} ${Ct(this.hass, e).toLocaleLowerCase()}`;
		return E`<div class="state-${e.state}">${t}</div>
      ${e.open ? St(e.open) : O}`;
	}
	static {
		this.styles = [
			q,
			dt,
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
          24px minmax(160px, 1fr) minmax(200px, 1fr) 90px minmax(170px, 1fr)
          150px 96px 32px;
        gap: 8px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        min-width: 960px;
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
      button.remove {
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
        cursor: grab;
        user-select: none;
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
//#region src/panel/settings-view.ts
var Jt = "notify.mobile_app_", Yt = "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z";
function Xt(e) {
	return {
		...e,
		notify_targets: [...e.notify_targets]
	};
}
function Zt(e) {
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
function Qt(e) {
	return e.slice(18).replaceAll("_", " ");
}
G("irrigation-settings-view", class extends N {
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
		return this._draft !== void 0 && Zt(this._draft) !== this.baseline;
	}
	willUpdate(e) {
		this.snapshot && (!this._draft || e.has("snapshot") && !this.dirty && !this.saving) && this.reset(this.snapshot.settings);
	}
	reset(e) {
		this._draft = Xt(e), this.baseline = Zt(e), e.global_max_valves !== null && (this.lastMax = e.global_max_valves);
	}
	patch(e) {
		if (!this._draft) return;
		this._draft = {
			...this._draft,
			...e
		};
		let t = Object.keys(e);
		this._errors = Object.fromEntries(Object.entries(this._errors).filter(([e]) => !t.some((t) => e === t || e.startsWith(`${t}.`)))), B(this, "settings-dirty", this.dirty);
	}
	async save() {
		if (this._draft && !this.saving) {
			this.saving = !0;
			try {
				let e = await Le(this.hass, this._draft);
				if (e.errors.length || !e.settings) {
					this._errors = Xe(this.hass, e.errors), V(this, F(this.hass, "settings_not_saved"));
					return;
				}
				this._errors = {}, this.reset(e.settings), V(this, F(this.hass, "settings_saved")), B(this, "settings-dirty", !1);
			} catch (e) {
				V(this, H(this.hass, e));
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
		return t ? E`<div class="error-text">${t}</div>` : O;
	}
	render() {
		let e = this._draft;
		if (!this.hass || !e) return O;
		let t = !(this.hass.user?.is_admin ?? !1);
		return E`${t ? E`<div class="banner info">${F(this.hass, "read_only")}</div>` : O}
    ${this.renderConcurrency(e, t)} ${this.renderNotifications(e, t)}
    ${this.renderRain(e, t)}`;
	}
	renderConcurrency(e, t) {
		let n = this.hass, r = e.global_max_valves !== null;
		return E`<div class="card section">
      <div class="label">${F(n, "concurrency")}</div>
      <ha-selector
        .hass=${n}
        .selector=${{ boolean: {} }}
        .label=${F(n, "limit_global")}
        .value=${r}
        .disabled=${t}
        @value-changed=${(e) => this.toggleLimit(K(e) ?? !1)}
      ></ha-selector>
      ${r ? E`<ha-selector
            class="narrow-field"
            .hass=${n}
            .selector=${{ number: {
			min: 1,
			max: 50,
			mode: "box"
		} }}
            .label=${F(n, "global_max")}
            .value=${e.global_max_valves}
            .disabled=${t}
            @value-changed=${(e) => {
			let t = Math.trunc(K(e) ?? 0);
			this.lastMax = t, this.patch({ global_max_valves: t });
		}}
          ></ha-selector>` : O}
      ${this.error("global_max_valves")}
      <div class="muted small">${F(n, "global_off_help")}</div>
    </div>`;
	}
	renderNotifications(e, t) {
		let n = this.hass, r = Object.keys(n.services.notify ?? {}).map((e) => `notify.${e}`).filter((e) => e.startsWith(Jt)), i = [.../* @__PURE__ */ new Set([...r, ...e.notify_targets])].sort();
		return E`<div class="card section">
      <div class="label">${F(n, "notifications")}</div>
      <div class="muted small help">${F(n, "notifications_help")}</div>
      <div class="chips">
        ${i.map((n) => E`<button
              class="chip with-icon ${e.notify_targets.includes(n) ? "on" : ""}"
              ?disabled=${t}
              title=${n}
              aria-pressed=${e.notify_targets.includes(n) ? "true" : "false"}
              @click=${() => this.toggleTarget(n)}
            >
              ${W(Yt)}${Qt(n)}
            </button>`)}
      </div>
      ${e.notify_targets.map((e, t) => this.error(`notify_targets.${t}`))}
      ${i.length ? O : E`<div class="muted small">${F(n, "no_targets")}</div>`}
    </div>`;
	}
	renderRain(e, t) {
		let n = this.hass, r = !this._errors.rain_past_hours && !this._errors.rain_past_threshold_mm, i = !this._errors.rain_forecast_hours && !this._errors.rain_forecast_threshold_mm;
		return E`<div class="card section">
      <div class="label">${F(n, "rain")}</div>
      <div class="muted small help">${F(n, "rain_help")}</div>

      <div class="subtitle">${F(n, "rain_past")}</div>
      <ha-selector
        .hass=${n}
        .selector=${{ entity: { domain: "sensor" } }}
        .label=${F(n, "rain_sensor")}
        .required=${!1}
        .value=${e.rain_sensor ?? void 0}
        .disabled=${t}
        @value-changed=${(e) => this.patch({ rain_sensor: K(e) || null })}
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
            .label=${F(n, "rain_past_hours")}
            .value=${e.rain_past_hours}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_past_hours: Math.trunc(K(e) ?? 0) })}
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
            .label=${F(n, "rain_past_threshold")}
            .value=${e.rain_past_threshold_mm}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_past_threshold_mm: K(e) ?? 0 })}
          ></ha-selector>
          ${this.error("rain_past_threshold_mm")}
        </div>
      </div>
      ${r ? E`<div class="muted small rule">
            ${F(n, "rain_past_rule", {
			mm: e.rain_past_threshold_mm,
			hours: e.rain_past_hours
		})}
          </div>` : O}

      <div class="subtitle">${F(n, "rain_forecast")}</div>
      <ha-selector
        .hass=${n}
        .selector=${{ entity: { domain: "weather" } }}
        .label=${F(n, "weather_entity")}
        .required=${!1}
        .value=${e.weather_entity ?? void 0}
        .disabled=${t}
        @value-changed=${(e) => this.patch({ weather_entity: K(e) || null })}
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
            .label=${F(n, "rain_forecast_hours")}
            .value=${e.rain_forecast_hours}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_forecast_hours: Math.trunc(K(e) ?? 0) })}
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
            .label=${F(n, "rain_forecast_threshold")}
            .value=${e.rain_forecast_threshold_mm}
            .disabled=${t}
            @value-changed=${(e) => this.patch({ rain_forecast_threshold_mm: K(e) ?? 0 })}
          ></ha-selector>
          ${this.error("rain_forecast_threshold_mm")}
        </div>
      </div>
      ${i ? E`<div class="muted small rule">
            ${F(n, "rain_forecast_rule", {
			mm: e.rain_forecast_threshold_mm,
			hours: e.rain_forecast_hours
		})}
          </div>` : O}
    </div>`;
	}
	static {
		this.styles = [q, o`
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
}), G("irrigation-scheduler-panel", class extends N {
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
		super(), this.store = new R(this), this.narrow = !1, this._tab = "zones", this._zoneId = void 0, this._ready = !1, this._settingsDirty = !1;
	}
	connectedCallback() {
		super.connectedCallback(), ut().then(() => {
			this._ready = !0;
		});
	}
	render() {
		if (!this.hass) return O;
		let { snapshot: e } = this.store.state;
		return this._tab === "zones" && this._zoneId !== void 0 && e && this._ready ? E`<irrigation-zone-editor
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
      ></irrigation-zone-editor>` : E`${this.renderToolbar()}
      <div class="content ${this._tab}">${this.renderBody()}</div>`;
	}
	renderToolbar() {
		let e = this.hass, { snapshot: t } = this.store.state, n = e.user?.is_admin ?? !1, r = O;
		return this._tab === "zones" && t ? r = U(this, e, {
			action: "pause",
			run: (e) => Be(e)
		}, F(e, "pause_all")) : this._tab === "settings" && t && n && (r = E`<button
        class="filled"
        ?disabled=${!this._settingsDirty || !e.connected}
        @click=${this.saveSettings}
      >
        ${F(e, "save")}
      </button>`), E`<div class="toolbar">
      <ha-menu-button .hass=${e} .narrow=${this.narrow}></ha-menu-button>
      <span class="title">${F(e, "title")}</span>
      <button class="tab ${this._tab === "zones" ? "active" : ""}" @click=${() => this.selectTab("zones")}>
        ${F(e, "tab_zones")}
      </button>
      <button class="tab ${this._tab === "settings" ? "active" : ""}" @click=${() => this.selectTab("settings")}>
        ${F(e, "tab_settings")}
      </button>
      <span class="spacer"></span>
      ${r}
    </div>`;
	}
	renderBody() {
		let e = this.hass, { snapshot: t, error: n } = this.store.state;
		if (n === "not_loaded") return E`<div class="banner warning">${F(e, "not_loaded")}</div>`;
		if (n) return E`<div class="banner error">${F(e, "load_error")}</div>`;
		if (!t || !this._ready) return E`<div class="muted">${F(e, "loading")}</div>`;
		let r = e.connected ? O : E`<div class="banner error">${F(e, "disconnected")}</div>`;
		return this._tab === "settings" ? E`${r}<irrigation-settings-view
          .hass=${e}
          .snapshot=${t}
          @settings-dirty=${(e) => {
			this._settingsDirty = e.detail;
		}}
        ></irrigation-settings-view>` : E`${r}<irrigation-zone-list
        .hass=${e}
        .snapshot=${t}
        @zone-open=${(e) => {
			this._zoneId = e.detail.zoneId;
		}}
      ></irrigation-zone-list>`;
	}
	async selectTab(e) {
		e !== this._tab && (!this._settingsDirty || await J(this.hass, {
			text: F(this.hass, "confirm_discard_settings"),
			confirmText: F(this.hass, "confirm_discard_action"),
			destructive: !0
		})) && (this._settingsDirty = !1, this._zoneId = void 0, this._tab = e);
	}
	async saveSettings() {
		await this.renderRoot.querySelector("irrigation-settings-view")?.save();
	}
	static {
		this.styles = [
			q,
			dt,
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
//#region src/card/irrigation-card.ts
var $t = "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z", en = "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z", tn = "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z", $ = "irrigation-scheduler-card", nn = 3e3;
G($, class extends N {
	static {
		this.properties = {
			hass: { attribute: !1 },
			_config: { state: !0 },
			_expanded: { state: !0 },
			_editing: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new R(this), this.hass = void 0, this._config = void 0, this._expanded = /* @__PURE__ */ new Set(), this._editing = void 0, new z(this);
	}
	setConfig(e) {
		let t = e?.zones ?? [];
		if (!Array.isArray(t) || t.some((e) => typeof e != "string")) throw Error(F(void 0, "card_bad_zones"));
		this._config = {
			...e,
			zones: [...t]
		};
	}
	getCardSize() {
		return 1 + (this._config?.zones.length || this.store.state.snapshot?.zones.length || 1);
	}
	static getConfigElement() {
		return document.createElement(`${$}-editor`);
	}
	static async getStubConfig(e) {
		let t = [];
		try {
			let n = new Promise((e, t) => window.setTimeout(() => t(/* @__PURE__ */ Error("timeout")), nn));
			t = (await Promise.race([Pe(e), n])).zones.slice(0, 3).map((e) => e.zone_id);
		} catch {}
		return {
			type: `custom:${$}`,
			zones: t
		};
	}
	toggle(e) {
		let t = new Set(this._expanded);
		t.has(e) ? t.delete(e) : t.add(e), this._expanded = t;
	}
	async openEditor(e) {
		await ut(), this._editing = e;
	}
	updated() {
		let e = this.renderRoot.querySelector("dialog.editor");
		e && !e.open && e.showModal();
	}
	renderEditor(e, t) {
		return E`<dialog
      class="editor"
      @cancel=${(e) => {
			e.preventDefault(), this.renderRoot.querySelector("irrigation-zone-editor")?.back();
		}}
    >
      <irrigation-zone-editor
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
		if (!e || !t) return O;
		let { snapshot: n, error: r } = this.store.state, i = t.user?.is_admin ?? !1, a;
		if (r === "not_loaded") a = E`<div class="muted">${F(t, "not_loaded")}</div>`;
		else if (r) a = E`<div class="muted">${F(t, "load_error")}</div>`;
		else if (!n) a = E`<div class="muted">${F(t, "loading")}</div>`;
		else {
			let r = e.zones.length ? e.zones : n.zones.map((e) => e.zone_id);
			a = r.length ? r.map((e) => this.renderZone(t, n, e)) : E`<div class="muted">${F(t, "empty_list")}</div>`;
		}
		return E`<ha-card .header=${e.title}>
      <div class="card-content">
        ${n && !t.connected ? E`<div class="banner error">${F(t, "disconnected")}</div>` : O}
        ${a}
        ${n && i ? E`<div class="footer">
              <button ?disabled=${!t.connected} @click=${() => this.openEditor(null)}>${F(t, "add_zone")}</button>
            </div>` : O}
      </div>
      ${n && this._editing !== void 0 ? this.renderEditor(t, n) : O}
    </ha-card>`;
	}
	renderZone(e, t, n) {
		let r = t.zones.find((e) => e.zone_id === n);
		if (!r) return E`<div class="zone-row muted">⚠ ${F(e, "zone_not_found")}</div>`;
		let i = Ot(r, t), a = this._expanded.has(n), o = i === "running" ? Mt(r, t) : void 0, s = i === "running" ? jt(r) : void 0;
		return E`<div class="zone ${i === "stopped" ? "stopped" : ""}">
      <div class="zone-row" @click=${() => this.toggle(n)}>
        <button
          class="icon expand"
          aria-expanded=${a ? "true" : "false"}
          @click=${(e) => {
			e.stopPropagation(), this.toggle(n);
		}}
        >
          ${W(a ? en : $t)}
        </button>
        <span class="icon">${Et[i]}</span>
        <div class="main">
          <div class="name">${r.name}</div>
          <div class="small muted">${this.zoneLine(e, r, i, o, s)}</div>
          ${s ? St(s) : O}
        </div>
        <div class="buttons">
          ${Nt(r, i).map((t) => U(this, e, t))}
          ${e.user?.is_admin ? E`<button
                class="icon configure"
                title=${F(e, "configure_zone")}
                aria-label=${F(e, "configure_zone")}
                @click=${(e) => {
			e.stopPropagation(), this.openEditor(r.zone_id);
		}}
              >
                ${W(tn)}
              </button>` : O}
        </div>
      </div>
      ${a ? E`<div class="valves">${r.valves.map((n) => this.renderValve(e, t, n))}</div>` : O}
    </div>`;
	}
	zoneLine(e, t, n, r, i) {
		switch (n) {
			case "running":
				if (i) {
					let t = L(Y(i));
					return `${F(e, "batch")} · ${F(e, "remaining", { time: t })}`;
				}
				return r && !r.open ? `${r.valve.name} · ${F(e, "status_manual")}` : F(e, "status_running");
			case "queued": return F(e, "status_queued");
			case "idle": return `${F(e, "status_idle")} · ${Je(e, t.next_run)}`;
			case "stopped": return F(e, "status_stopped");
		}
	}
	renderValve(e, t, n) {
		let r = xt(n, t), i = "";
		return r.open ? i = L(Y(r.open)) : r.state !== "idle" && (i = Ct(e, r).toLocaleLowerCase()), E`<div class="valve">
      <span class="icon">${yt[r.state]}</span>
      <div class="main">
        <div>${n.name} · ${F(e, "minutes_short", { n: n.duration_min })}</div>
        ${r.open ? St(r.open) : O}
      </div>
      <span class="small muted">${i}</span>
      <div class="buttons">${wt(n, r).map((t) => U(this, e, t))}</div>
    </div>`;
	}
	static {
		this.styles = [q, o`
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
      .valve > .small {
        white-space: nowrap;
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
      .valve {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
    `];
	}
}), window.customCards ??= [], window.customCards.some((e) => e.type === "irrigation-scheduler-card") || window.customCards.push({
	type: $,
	name: "Irrigation Scheduler",
	description: F(void 0, "card_description"),
	preview: !0
});
//#endregion
//#region src/card/card-editor.ts
var rn = class extends N {
	static {
		this.properties = {
			hass: { attribute: !1 },
			_config: { state: !0 }
		};
	}
	constructor() {
		super(), this.store = new R(this), this.hass = void 0, this._config = void 0;
	}
	connectedCallback() {
		super.connectedCallback(), ut().then(() => this.requestUpdate());
	}
	setConfig(e) {
		this._config = {
			...e,
			zones: Array.isArray(e.zones) ? [...e.zones] : []
		};
	}
	changeConfig(e) {
		if (!this._config) return;
		let t = {
			...this._config,
			...e
		};
		t.title || delete t.title, this._config = t, B(this, "config-changed", { config: t });
	}
	addZone(e) {
		let t = e.target, n = t.value;
		t.value = "", this._config && n && this.changeConfig({ zones: [...this._config.zones, n] });
	}
	render() {
		let e = this.hass, t = this._config;
		if (!e || !t) return O;
		let n = this.store.state.snapshot?.zones ?? [], r = (e) => n.find((t) => t.zone_id === e)?.name ?? e, i = n.filter((e) => !t.zones.includes(e.zone_id));
		return E`
      <div class="section">
        <div class="label">${F(e, "card_zones")}</div>
        <div class="chips">
          ${t.zones.map((e) => E`<button
                class="chip on"
                @click=${() => this.changeConfig({ zones: t.zones.filter((t) => t !== e) })}
              >
                ${r(e)} ✕
              </button>`)}
          ${i.length ? E`<select @change=${this.addZone}>
                <option value="" selected>${F(e, "add_zone")}</option>
                ${i.map((e) => E`<option .value=${e.zone_id}>${e.name}</option>`)}
              </select>` : O}
        </div>
        <div class="muted small">
          ${F(e, t.zones.length ? "card_order_help" : "card_all_zones")}
        </div>
      </div>
      <!-- ha-selector marca required por defecto: sin esto sale el asterisco -->
      <ha-selector
        .hass=${e}
        .selector=${{ text: {} }}
        .label=${F(e, "card_title")}
        .required=${!1}
        .value=${t.title ?? ""}
        @value-changed=${(e) => this.changeConfig({ title: K(e) ?? "" })}
      ></ha-selector>
    `;
	}
	static {
		this.styles = [q, o`
      :host {
        display: block;
      }
      .chips {
        margin-bottom: 4px;
      }
    `];
	}
};
G(`${$}-editor`, rn);
//#endregion
