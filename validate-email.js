
(function () {
  var EMAIL_RE =
    /^[^\s"(),:;<>@[\\\]]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i;

  var JUNK_MAILBOXES = [
    'test', 'testing', 'example', 'sample', 'noreply',
    'johndoe', 'janedoe', 'johnsmith', 'qwerty',
  ];

  var domainCache = {};

  function isJunkMailbox(email) {
    var parts = email.split('@');
    var local = parts[0].split('+')[0];
    if (parts[1] === 'gmail.com' || parts[1] === 'googlemail.com') {
      local = local.replace(/\./g, '');
    }
    return JUNK_MAILBOXES.indexOf(local) !== -1;
  }

  function dnsQuery(domain, type) {
    return fetch(
      'https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=' + type
    ).then(function (res) {
      if (!res.ok) throw new Error('DNS ' + res.status);
      return res.json();
    });
  }

  async function lookupDomain(domain) {
    try {
      var data = await dnsQuery(domain, 'MX');
      if (data.Status === 3) return false;
      if (data.Status !== 0) return true;

      var mx = (data.Answer || []).filter(function (a) { return a.type === 15; });
      if (mx.length > 0) {
        return mx.some(function (a) {
          var target = String(a.data).trim().split(/\s+/)[1] || '';
          return target !== '' && target !== '.';
        });
      }

      var records = [['A', 1], ['AAAA', 28]];
      for (var i = 0; i < records.length; i++) {
        var addr = await dnsQuery(domain, records[i][0]);
        if (addr.Status !== 0) return true;
        if ((addr.Answer || []).some(function (a) { return a.type === records[i][1]; })) return true;
      }
      return false;
    } catch (err) {
      return true;
    }
  }

  function checkDomain(domain) {
    if (!domainCache[domain]) {
      var timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(true); }, 4000);
      });
      domainCache[domain] = Promise.race([lookupDomain(domain), timeout]);
    }
    return domainCache[domain];
  }

  window.validateEmail = async function (value) {
    var email = String(value || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { isValid: false, email: email, reason: 'FORMAT' };
    if (isJunkMailbox(email)) return { isValid: false, email: email, reason: 'JUNK' };
    var domainOk = await checkDomain(email.split('@')[1]);
    return domainOk
      ? { isValid: true, email: email, reason: null }
      : { isValid: false, email: email, reason: 'DOMAIN' };
  };
})();
