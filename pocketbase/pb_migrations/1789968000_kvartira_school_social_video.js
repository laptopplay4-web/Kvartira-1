/// <reference path="../pb_data/types.d.ts" />

/**
 * School settings: socialLinks + directionsVideo JSON;
 * kvartira_files purpose "school" + public file access for school/avatar.
 */

const PURPOSE_VALUES = ['chat', 'assignment', 'support', 'avatar', 'school'];

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';
const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || purpose = "school" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || (@collection.assignment_groups.id ?= @collection.assignments.group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id)))) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

migrate(
  (app) => {
    const school = app.findCollectionByNameOrId('school_settings');
    if (!school.fields.getByName('socialLinks')) {
      school.fields.add(new Field({ name: 'socialLinks', type: 'json' }));
    }
    if (!school.fields.getByName('directionsVideo')) {
      school.fields.add(new Field({ name: 'directionsVideo', type: 'json' }));
    }
    app.save(school);

    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (purposeField) {
      purposeField.values = PURPOSE_VALUES;
    }
    files.listRule = FILE_ACCESS;
    files.viewRule = FILE_ACCESS;
    app.save(files);
  },
  (app) => {
    const school = app.findCollectionByNameOrId('school_settings');
    const social = school.fields.getByName('socialLinks');
    if (social) school.fields.remove(social.id);
    const video = school.fields.getByName('directionsVideo');
    if (video) school.fields.remove(video.id);
    app.save(school);

    const files = app.findCollectionByNameOrId('kvartira_files');
    const purposeField = files.fields.getByName('purpose');
    if (purposeField) {
      purposeField.values = ['chat', 'assignment', 'support', 'avatar'];
    }
    app.save(files);
  },
);
