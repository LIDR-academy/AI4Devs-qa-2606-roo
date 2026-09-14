import seed from '../../fixtures/seedData.json';

const { john } = seed.candidates;
const apiUrl = () => Cypress.expose('apiUrl');
const uniqueEmail = (prefix) => `${prefix}.${Date.now()}@example.com`;
const E2E_FILE_MARK = 'cypress-e2e';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('EXT - Interfaz Add Candidate: alta de candidatos', () => {
  before(() => {
    cy.resetDb();
  });

  beforeEach(() => {
    cy.intercept('POST', `${apiUrl()}/candidates`).as('createCandidate');
    cy.intercept('POST', `${apiUrl()}/upload`).as('uploadCv');
    cy.visit('/add-candidate');
  });

  context('Alta de candidato', () => {
    it('EXT-05 - registra un candidato con datos personales válidos', () => {
      const email = uniqueEmail('ana.garcia');

      // When
      cy.fixture('candidate').then((candidate) => cy.fillCandidateForm({ ...candidate, email }));
      cy.contains('button', 'Enviar').click();

      // Then
      cy.wait('@createCandidate').then(({ response }) => {
        expect(response.statusCode).to.eq(201);
        cy.request('GET', `${apiUrl()}/candidates/${response.body.id}`)
          .its('body')
          .should('include', { email, firstName: 'Ana', lastName: 'Garcia' });
      });
      cy.get('.alert-success').should('have.text', 'Candidato añadido con éxito');
    });

    it('EXT-06 - registra un candidato con educación y experiencia laboral', () => {
      const email = uniqueEmail('laura.martin');

      // When
      cy.fillCandidateForm({ firstName: 'Laura', lastName: 'Martín', email });

      cy.contains('button', 'Añadir Educación').click();
      cy.get('input[name="institution"]').type('UC3M');
      cy.get('input[name="title"]').type('Computer Science');
      cy.get('input[placeholder="Fecha de Inicio"]').eq(0).type('2006-09-01{esc}');
      cy.get('input[placeholder="Fecha de Fin"]').eq(0).type('2010-06-30{esc}');

      cy.contains('button', 'Añadir Experiencia Laboral').click();
      cy.get('input[name="company"]').type('Coca Cola');
      cy.get('input[name="position"]').type('SWE');
      cy.get('input[placeholder="Fecha de Inicio"]').eq(1).type('2011-01-13{esc}');
      cy.get('input[placeholder="Fecha de Fin"]').eq(1).type('2013-01-17{esc}');

      cy.contains('button', 'Enviar').click();

      // Then
      cy.wait('@createCandidate').then(({ request, response }) => {
        expect(request.body.educations).to.deep.equal([
          { institution: 'UC3M', title: 'Computer Science', startDate: '2006-09-01', endDate: '2010-06-30' }
        ]);
        expect(request.body.workExperiences).to.deep.equal([
          { company: 'Coca Cola', position: 'SWE', description: '', startDate: '2011-01-13', endDate: '2013-01-17' }
        ]);
        expect(response.statusCode).to.eq(201);

        cy.request('GET', `${apiUrl()}/candidates/${response.body.id}`)
          .its('body')
          .then((candidate) => {
            expect(candidate.educations).to.have.length(1);
            expect(candidate.educations[0]).to.include({ institution: 'UC3M', title: 'Computer Science' });
            expect(candidate.workExperiences).to.have.length(1);
            expect(candidate.workExperiences[0]).to.include({ company: 'Coca Cola', position: 'SWE' });
          });
      });
      cy.get('.alert-success').should('have.text', 'Candidato añadido con éxito');
    });

    it('EXT-07 - permite añadir y eliminar secciones de educación y experiencia laboral', () => {
      cy.contains('button', 'Añadir Educación').click();
      cy.contains('button', 'Añadir Educación').click();
      cy.get('input[name="institution"]').should('have.length', 2);

      cy.get('input[name="institution"]').first().closest('.mb-3').contains('button', 'Eliminar').click();
      cy.get('input[name="institution"]').should('have.length', 1);

      cy.contains('button', 'Añadir Experiencia Laboral').click();
      cy.get('input[name="company"]').should('have.length', 1);

      cy.get('input[name="company"]').closest('.mb-3').contains('button', 'Eliminar').click();
      cy.get('input[name="company"]').should('not.exist');
    });

    it('EXT-08 - no envía el formulario si faltan los campos obligatorios', () => {
      cy.contains('button', 'Enviar').click();

      cy.get('input[name="firstName"]').then(($input) => {
        expect($input[0].validity.valueMissing).to.eq(true);
      });
      cy.get('.alert').should('not.exist');
      cy.get('@createCandidate.all').should('have.length', 0);
    });

    it('EXT-09 - no envía el formulario si el email no tiene un formato válido', () => {
      cy.fillCandidateForm({ firstName: 'Ana', lastName: 'Garcia', email: 'correo-invalido' });
      cy.contains('button', 'Enviar').click();

      cy.get('input[name="email"]').then(($input) => {
        expect($input[0].validity.typeMismatch).to.eq(true);
      });
      cy.get('.alert').should('not.exist');
      cy.get('@createCandidate.all').should('have.length', 0);
    });

    it('EXT-10 - muestra un error cuando el nombre contiene caracteres inválidos', () => {
      cy.fillCandidateForm({ firstName: 'Ana123', lastName: 'Garcia', email: uniqueEmail('ana.invalida') });
      cy.contains('button', 'Enviar').click();

      cy.wait('@createCandidate').its('response.statusCode').should('eq', 400);
      cy.get('.alert-danger').should('contain', 'Error al añadir candidato').and('contain', 'Invalid name');
    });

    it('EXT-11 - muestra un error cuando el teléfono no tiene un formato válido', () => {
      cy.fillCandidateForm({
        firstName: 'Ana',
        lastName: 'Garcia',
        email: uniqueEmail('ana.telefono'),
        phone: '12345'
      });
      cy.contains('button', 'Enviar').click();

      cy.wait('@createCandidate').its('response.statusCode').should('eq', 400);
      cy.get('.alert-danger').should('contain', 'Invalid phone');
    });

    it('EXT-12 - muestra un error cuando el email ya existe en el sistema', () => {
      // Given: el seed contiene un candidato con este email
      cy.fillCandidateForm({ firstName: 'Nuevo', lastName: 'Candidato', email: john.email });

      // When
      cy.contains('button', 'Enviar').click();

      // Then
      cy.wait('@createCandidate').its('response.statusCode').should('eq', 400);
      cy.get('.alert-danger').should('contain', 'The email already exists in the database');
    });
  });

  context('Subida de CV', () => {
    const selectCv = (fileName, mimeType, contents) =>
      cy.get('input[type="file"]').selectFile(
        { contents: contents || Cypress.Buffer.from('%PDF-1.4 cypress e2e'), fileName, mimeType },
        { force: true }
      );

    before(() => {
      cy.task('uploads:ensureDir');
    });

    after(() => {
      cy.task('uploads:cleanup', E2E_FILE_MARK);
    });

    it('EXT-13 - sube un CV en PDF y lo asocia al candidato registrado', () => {
      const fileName = `${E2E_FILE_MARK}-cv.pdf`;
      const email = uniqueEmail('pedro.ruiz');

      // When
      selectCv(fileName, 'application/pdf');
      cy.contains('button', 'Subir Archivo').click();

      // Then
      cy.wait('@uploadCv').then(({ response }) => {
        expect(response.statusCode).to.eq(200);
        expect(response.body.fileType).to.eq('application/pdf');
        expect(response.body.filePath).to.contain(fileName);
        cy.wrap(response.body).as('uploadedCv');
      });
      cy.contains('Archivo subido con éxito').should('be.visible');

      // When
      cy.fillCandidateForm({ firstName: 'Pedro', lastName: 'Ruiz', email });
      cy.contains('button', 'Enviar').click();

      // Then
      cy.get('@uploadedCv').then((uploadedCv) => {
        cy.wait('@createCandidate').then(({ request, response }) => {
          expect(request.body.cv).to.deep.equal(uploadedCv);
          expect(response.statusCode).to.eq(201);

          cy.request('GET', `${apiUrl()}/candidates/${response.body.id}`)
            .its('body.resumes')
            .then((resumes) => {
              expect(resumes).to.have.length(1);
              expect(resumes[0]).to.include(uploadedCv);
            });
        });
      });
    });

    it('EXT-14 - acepta un CV en formato DOCX', () => {
      selectCv(`${E2E_FILE_MARK}-cv.docx`, DOCX_MIME);
      cy.contains('button', 'Subir Archivo').click();

      cy.wait('@uploadCv').then(({ response }) => {
        expect(response.statusCode).to.eq(200);
        expect(response.body.fileType).to.eq(DOCX_MIME);
      });
      cy.contains('Archivo subido con éxito').should('be.visible');
    });

    it('EXT-15 - rechaza un archivo con un tipo no permitido', () => {
      selectCv(`${E2E_FILE_MARK}-foto.png`, 'image/png', Cypress.Buffer.from('fake png'));
      cy.contains('button', 'Subir Archivo').click();

      cy.wait('@uploadCv').then(({ response }) => {
        expect(response.statusCode).to.eq(400);
        expect(response.body.error).to.eq('Invalid file type, only PDF and DOCX are allowed!');
      });
      cy.contains('Archivo subido con éxito').should('not.exist');
    });

    it('EXT-16 - rechaza un CV que supera el tamaño máximo de 10MB', () => {
      selectCv(`${E2E_FILE_MARK}-grande.pdf`, 'application/pdf', Cypress.Buffer.alloc(10 * 1024 * 1024 + 1));
      cy.contains('button', 'Subir Archivo').click();

      cy.wait('@uploadCv').then(({ response }) => {
        expect(response.statusCode).to.eq(500);
        expect(response.body.error).to.eq('File too large');
      });
      cy.contains('Archivo subido con éxito').should('not.exist');
    });
  });
});

describe('EXT - Consulta de candidato por ID', () => {
  it('EXT-17 - GET /candidates/:id responde 404 si no existe y 400 si el ID no es numérico', () => {
    cy.request({ url: `${apiUrl()}/candidates/999999`, failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(404);
      expect(response.body.error).to.eq('Candidate not found');
    });

    cy.request({ url: `${apiUrl()}/candidates/abc`, failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.error).to.eq('Invalid ID format');
    });
  });
});
