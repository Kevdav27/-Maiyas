/* Site behaviour for navigation, the gallery and the enquiry forms.
   Forms never post personal details to a server. After checks, the
   message is placed in a WhatsApp draft the visitor chooses to send. */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "447348426709";
  var SEND_GAP_MS = 20000;

  var SERVICE_OPTIONS = [
    "Hedge trimming",
    "Tree works",
    "Garden maintenance",
    "Garden design",
    "Decorative gravel",
    "Fencing",
    "Not sure yet"
  ];

  var PROPERTY_OPTIONS = [
    "House",
    "Bungalow",
    "Flat with a garden",
    "Commercial premises",
    "Other"
  ];

  var SIZE_OPTIONS = ["Small", "Medium", "Large", "Not sure"];
  var CONTACT_OPTIONS = ["Phone", "WhatsApp", "Either"];

  /**
   * Keep text safe to drop into a URL and to show back with textContent.
   * Strips control characters, bidi overrides and angle brackets, then cuts
   * the string to the field's maximum length.
   */
  function sanitizeText(value, maxLength) {
    var text = String(value == null ? "" : value);
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    text = text.replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
    text = text.replace(/[<>]/g, "");
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (text.length > maxLength) {
      text = text.slice(0, maxLength).trim();
    }
    return text;
  }

  function allow(value, list) {
    return list.indexOf(value) !== -1 ? value : "";
  }

  function isUkPhone(value) {
    var digits = value.replace(/\D/g, "");
    if (digits.indexOf("44") === 0) {
      digits = "0" + digits.slice(2);
    }
    return /^0\d{9,10}$/.test(digits);
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function isUkPostcode(value) {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value);
  }

  /** encodeURIComponent stops the message from adding extra URL parameters. */
  function whatsAppUrl(message) {
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);
  }

  function storageGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      /* Private mode can block storage. The send is still allowed. */
    }
  }

  /**
   * Only a timestamp is stored, never the enquiry itself.
   * It just stops a double-click from opening several WhatsApp drafts.
   */
  function sentTooRecently() {
    var previous = Number(storageGet("maiya-last-send") || 0);
    return previous > 0 && Date.now() - previous < SEND_GAP_MS;
  }

  function markSent() {
    storageSet("maiya-last-send", String(Date.now()));
  }

  function honeypotTripped(form) {
    var trap = form.querySelector("[name='maiya_hp']");
    return trap && trap.value.trim() !== "";
  }

  function setError(input, errorNode, message) {
    if (!input || !errorNode) {
      return;
    }
    if (message) {
      input.setAttribute("aria-invalid", "true");
      errorNode.hidden = false;
      errorNode.textContent = message;
    } else {
      input.removeAttribute("aria-invalid");
      errorNode.hidden = true;
      errorNode.textContent = "";
    }
  }

  function clearGroup(form) {
    form.querySelectorAll("[aria-invalid]").forEach(function (input) {
      input.removeAttribute("aria-invalid");
    });
    form.querySelectorAll(".field-error").forEach(function (node) {
      node.hidden = true;
      node.textContent = "";
    });
  }

  /**
   * Open WhatsApp from a real link click so the browser keeps the user gesture.
   * rel=noopener stops the new tab reading this page. The message is also
   * copied into a box the visitor can use if the chat does not open.
   */
  function openWhatsApp(message, linkNode, fallbackNode) {
    var url = whatsAppUrl(message);
    if (linkNode) {
      linkNode.href = url;
    }
    if (fallbackNode) {
      fallbackNode.value = message;
    }
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return url;
  }

  function initYear() {
    var yearNode = document.getElementById("year");
    if (yearNode) {
      yearNode.textContent = String(new Date().getFullYear());
    }
  }

  /** Escape closes the full-screen menu. Desktop never shows the disclosure. */
  function initNav() {
    var menu = document.querySelector(".menu-sheet");
    if (!menu) {
      return;
    }
    var summary = menu.querySelector("summary");
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        if (summary) {
          summary.focus();
        }
      }
    });
  }

  function initGallery() {
    var gallery = document.querySelector("[data-gallery]");
    var dialog = document.getElementById("lightbox");
    if (!gallery) {
      return;
    }

    var bar = gallery.querySelector("[data-filters]");
    if (bar) {
      /* Filters are a convenience. Without this script every picture stays visible. */
      bar.hidden = false;
      bar.addEventListener("click", function (event) {
        var button = event.target.closest("[data-filter]");
        if (!button) {
          return;
        }
        var filter = button.getAttribute("data-filter");
        bar.querySelectorAll("[data-filter]").forEach(function (item) {
          var active = item === button;
          item.setAttribute("aria-pressed", active ? "true" : "false");
        });
        gallery.querySelectorAll("[data-kind]").forEach(function (tile) {
          var show = filter === "all" || tile.getAttribute("data-kind") === filter;
          tile.hidden = !show;
        });
      });
    }

    if (!dialog || typeof dialog.showModal !== "function") {
      return;
    }

    var image = dialog.querySelector("img");
    var caption = dialog.querySelector("p");
    gallery.addEventListener("click", function (event) {
      var tile = event.target.closest("[data-full]");
      if (!tile) {
        return;
      }
      image.src = tile.getAttribute("data-full");
      image.alt = tile.getAttribute("data-alt") || "";
      caption.textContent = tile.getAttribute("data-caption") || "";
      dialog.showModal();
    });

    dialog.querySelector("[data-close]").addEventListener("click", function () {
      dialog.close();
    });

    /* A click on the backdrop (the dialog itself, not the picture) closes it. */
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }

  function selectedValues(form, name, list) {
    return Array.prototype.filter.call(
      form.querySelectorAll("input[name='" + name + "']:checked"),
      function (input) {
        return allow(input.value, list);
      }
    ).map(function (input) {
      return input.value;
    });
  }

  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) {
      return;
    }
    var status = document.getElementById("contact-status");
    var success = document.getElementById("contact-success");
    var link = document.getElementById("contact-wa-link");
    var fallback = document.getElementById("contact-fallback");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearGroup(form);
      status.textContent = "";

      if (honeypotTripped(form)) {
        form.hidden = true;
        success.hidden = false;
        return;
      }

      if (sentTooRecently()) {
        status.textContent = "Please wait a few seconds before sending another message.";
        return;
      }

      var nameInput = form.querySelector("#contact-name");
      var phoneInput = form.querySelector("#contact-phone");
      var emailInput = form.querySelector("#contact-email");
      var messageInput = form.querySelector("#contact-message");
      var consent = form.querySelector("#contact-consent");
      var name = sanitizeText(nameInput.value, 80);
      var phone = sanitizeText(phoneInput.value, 20);
      var email = sanitizeText(emailInput.value, 120);
      var message = sanitizeText(messageInput.value, 600);
      var valid = true;

      if (name.length < 2) {
        setError(nameInput, document.getElementById("err-contact-name"), "Please add your name.");
        valid = false;
      }
      if (!isUkPhone(phone)) {
        setError(phoneInput, document.getElementById("err-contact-phone"), "Please add a UK phone number.");
        valid = false;
      }
      if (email && !isEmail(email)) {
        setError(emailInput, document.getElementById("err-contact-email"), "That email does not look complete.");
        valid = false;
      }
      if (message.length < 8) {
        setError(messageInput, document.getElementById("err-contact-message"), "Please add a short note about the garden.");
        valid = false;
      }
      if (!consent.checked) {
        setError(consent, document.getElementById("err-contact-consent"), "Please confirm we can use these details to reply.");
        valid = false;
      }
      if (!valid) {
        status.textContent = "Check the highlighted fields and try again.";
        return;
      }

      var lines = [
        "Hello Maiya's Gardening Renovation, I have an enquiry.",
        "Name: " + name,
        "Phone: " + phone
      ];
      if (email) {
        lines.push("Email: " + email);
      }
      lines.push("Message: " + message);
      markSent();
      openWhatsApp(lines.join("\n"), link, fallback);
      form.hidden = true;
      success.hidden = false;
    });
  }

  function initQuoteForm() {
    var form = document.getElementById("quote-form");
    if (!form) {
      return;
    }

    var panels = Array.prototype.slice.call(form.querySelectorAll(".wizard__panel"));
    var stepItems = Array.prototype.slice.call(form.querySelectorAll(".wizard__steps li"));
    var status = document.getElementById("quote-status");
    var success = document.getElementById("quote-success");
    var link = document.getElementById("quote-wa-link");
    var fallback = document.getElementById("quote-fallback");
    var stepIndex = 0;

    function showStep(index) {
      stepIndex = index;
      panels.forEach(function (panel, panelIndex) {
        panel.hidden = panelIndex !== index;
      });
      stepItems.forEach(function (item, itemIndex) {
        item.classList.toggle("is-current", itemIndex === index);
        item.classList.toggle("is-done", itemIndex < index);
      });
      if (index === panels.length - 1) {
        var summary = document.getElementById("quote-summary");
        if (summary) {
          summary.textContent = buildMessage();
        }
      }
      var focusTarget = panels[index].querySelector("input, select, textarea, button");
      if (focusTarget) {
        focusTarget.focus();
      }
    }

    function validateStep(index) {
      clearGroup(form);
      status.textContent = "";

      if (index === 0) {
        var services = selectedValues(form, "service", SERVICE_OPTIONS);
        var serviceError = document.getElementById("err-service");
        if (!services.length) {
          serviceError.hidden = false;
          serviceError.textContent = "Choose at least one type of work.";
          status.textContent = "Choose at least one type of work.";
          return false;
        }
      }

      if (index === 1) {
        var postcodeInput = form.querySelector("#quote-postcode");
        var propertyInput = form.querySelector("#quote-property");
        var sizeInput = form.querySelector("#quote-size");
        var detailsInput = form.querySelector("#quote-details");
        var postcode = sanitizeText(postcodeInput.value, 10).toUpperCase();
        var details = sanitizeText(detailsInput.value, 600);
        var valid = true;
        if (!isUkPostcode(postcode)) {
          setError(postcodeInput, document.getElementById("err-postcode"), "Please add a full UK postcode.");
          valid = false;
        }
        if (!allow(propertyInput.value, PROPERTY_OPTIONS)) {
          setError(propertyInput, document.getElementById("err-property"), "Please choose the type of property.");
          valid = false;
        }
        if (!allow(sizeInput.value, SIZE_OPTIONS)) {
          setError(sizeInput, document.getElementById("err-size"), "Please choose a rough size.");
          valid = false;
        }
        if (details.length < 10) {
          setError(detailsInput, document.getElementById("err-details"), "Add a few words about the garden, at least a sentence.");
          valid = false;
        }
        if (!valid) {
          status.textContent = "Check the garden details and try again.";
        }
        return valid;
      }

      if (index === 2) {
        var nameInput = form.querySelector("#quote-name");
        var phoneInput = form.querySelector("#quote-phone");
        var emailInput = form.querySelector("#quote-email");
        var consent = form.querySelector("#quote-consent");
        var name = sanitizeText(nameInput.value, 80);
        var phone = sanitizeText(phoneInput.value, 20);
        var email = sanitizeText(emailInput.value, 120);
        var preference = selectedValues(form, "preference", CONTACT_OPTIONS);
        var validContact = true;
        if (name.length < 2) {
          setError(nameInput, document.getElementById("err-quote-name"), "Please add your name.");
          validContact = false;
        }
        if (!isUkPhone(phone)) {
          setError(phoneInput, document.getElementById("err-quote-phone"), "Please add a UK phone number.");
          validContact = false;
        }
        if (email && !isEmail(email)) {
          setError(emailInput, document.getElementById("err-quote-email"), "That email does not look complete.");
          validContact = false;
        }
        if (!preference.length) {
          document.getElementById("err-preference").hidden = false;
          document.getElementById("err-preference").textContent = "Tell us whether to call or use WhatsApp.";
          validContact = false;
        }
        if (!consent.checked) {
          setError(consent, document.getElementById("err-quote-consent"), "Please confirm we can use these details to reply.");
          validContact = false;
        }
        if (!validContact) {
          status.textContent = "Check your contact details and try again.";
        }
        return validContact;
      }

      return true;
    }

    function buildMessage() {
      var services = selectedValues(form, "service", SERVICE_OPTIONS);
      var postcode = sanitizeText(form.querySelector("#quote-postcode").value, 10).toUpperCase();
      var property = allow(form.querySelector("#quote-property").value, PROPERTY_OPTIONS);
      var size = allow(form.querySelector("#quote-size").value, SIZE_OPTIONS);
      var details = sanitizeText(form.querySelector("#quote-details").value, 600);
      var name = sanitizeText(form.querySelector("#quote-name").value, 80);
      var phone = sanitizeText(form.querySelector("#quote-phone").value, 20);
      var email = sanitizeText(form.querySelector("#quote-email").value, 120);
      var preference = selectedValues(form, "preference", CONTACT_OPTIONS)[0] || "";
      var lines = [
        "Quote request for Maiya's Gardening Renovation",
        "Services: " + services.join(", "),
        "Property: " + property,
        "Size: " + size,
        "Postcode: " + postcode,
        "Details: " + details,
        "Name: " + name,
        "Phone: " + phone,
        "Preferred contact: " + preference
      ];
      if (email) {
        lines.push("Email: " + email);
      }
      return lines.join("\n");
    }

    form.addEventListener("click", function (event) {
      var next = event.target.closest("[data-next]");
      var back = event.target.closest("[data-back]");
      if (back) {
        showStep(Math.max(0, stepIndex - 1));
        return;
      }
      if (next && validateStep(stepIndex)) {
        showStep(Math.min(panels.length - 1, stepIndex + 1));
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (stepIndex < panels.length - 1) {
        if (validateStep(stepIndex)) {
          showStep(stepIndex + 1);
        }
        return;
      }
      /* Re-check every step, then show the first one that still needs a fix. */
      if (!validateStep(0)) {
        showStep(0);
        return;
      }
      if (!validateStep(1)) {
        showStep(1);
        return;
      }
      if (!validateStep(2)) {
        showStep(2);
        return;
      }
      if (honeypotTripped(form)) {
        form.hidden = true;
        success.hidden = false;
        return;
      }
      if (sentTooRecently()) {
        status.textContent = "Please wait a few seconds before sending another message.";
        return;
      }
      markSent();
      openWhatsApp(buildMessage(), link, fallback);
      form.hidden = true;
      success.hidden = false;
    });
  }

  initYear();
  initNav();
  initGallery();
  initContactForm();
  initQuoteForm();
})();
