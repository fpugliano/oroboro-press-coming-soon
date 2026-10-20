// "Notify me" form: sends the address to the signup Worker and shows the result in place.
document.querySelectorAll('form.signup').forEach(function (form) {
  var msg = form.parentNode.querySelector('.msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var button = form.querySelector('button');
    var data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.body.ok) { form.hidden = true; msg.textContent = form.dataset.ok; msg.className = 'msg ok'; }
        else { msg.textContent = res.body.error === 'invalid_email' ? form.dataset.bad : form.dataset.err; msg.className = 'msg err'; button.disabled = false; }
      })
      .catch(function () { msg.textContent = form.dataset.err; msg.className = 'msg err'; button.disabled = false; });
  });
});
