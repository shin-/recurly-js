import Emitter from 'component-emitter';
import { Frame } from '../frame';

class AmazonPay extends Emitter {
  constructor (recurly, options) {
    super();
    this.recurly = recurly;
    this.options = options;
    this.region = this.options.region || 'us';
    this.setLocaleAndCurrency();
    this.start();
  }

  async start () {
    try {
      await Promise.all([
        this.loadExternalLibraries(),
        this.obtainMerchantId(this.recurly)
      ]);
    } catch (err) {
      this.error(err);
    }
  }

  obtainMerchantId () {
    this.recurly.request.get({ route: '/amazon_pay/button_render' }).then((data) => {
      this.options.merchantId = data.merchant_id;
    });
  }

  scriptUrl () {
    switch(this.options.region) {
    case 'uk':
    case 'eu':
      return 'https://static-eu.payments-amazon.com/checkout.js';
    case 'us':
      return 'https://static-na.payments-amazon.com/checkout.js';
    }
  }

  loadExternalLibraries () {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.scriptUrl();
      script.onload = () => {
        resolve;
        this.emit('ready');
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  renderButton (element) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.innerHTML = `const button = amazon.Pay.renderButton('#${element}', {
        merchantId: '${this.options.merchantId}',
        ledgerCurrency: '${this.options.currency}',
        checkoutLanguage: '${this.options.locale}',
        productType: 'PayOnly',
        placement: 'Other',
        sandbox: ${this.options.sandbox},
        buttonColor: 'Gold',
      });`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  attach () {
    const defaultEventName = 'amazon-pay';
    let gatewayCode = this.options.gatewayCode || '';
    this.frame = this.recurly.Frame({
      path: `/amazon_pay/start?region=${this.region}&gateway_code=${gatewayCode}`,
      type: Frame.TYPES.WINDOW,
      defaultEventName
    }).on('error', cause => this.emit('error', cause)) // Emitted by js/v1/amazon_pay/cancel
      .on('close', () => this.emit('error', 'closed')) // Emitted by RJS Frame when the window is manually closed
      .on('done', results => this.emit('token', results)); // Emitted by js/v1/amazon_pay/finish
  }

  setLocaleAndCurrency () {
    switch (this.options.region) {
    case 'uk':
      this.options.currency = 'GBP';
      this.options.locale = 'en_GB';
      break;
    case 'eu':
      this.options.currency = 'EUR';
      this.options.locale = 'en_GB';
      break;
    case 'us':
      this.options.currency = 'USD';
      this.options.locale = 'en_US';
      break;
    }
  }
}

export default AmazonPay;
